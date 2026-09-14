// Hydrographic Tide Calculation Engine for Port of Beira (Sinusoidal Harmonic Interpolation)
// Implements standard Admiralty / Rule of Twelfths continuous equivalent

import { BEIRA_TIDES_2026, DayTidePrediction, TideExtreme } from '../data/beiraTides2026';

export interface MinuteTideData {
  minuteOfDay: number; // 0 to 1439
  time: string; // "HH:mm"
  height: number; // meters (e.g. 5.14)
  trend: 'enchente' | 'vazante' | 'estofo_alta' | 'estofo_baixa';
  trendLabel: string;
  rateCmMin: number; // cm/min
  rateMetersHour: number; // m/hour
  previousExtreme: { time: string; height: number; type: 'HW' | 'LW' };
  nextExtreme: { time: string; height: number; type: 'HW' | 'LW' };
  isExtreme?: boolean;
  extremeType?: 'HW' | 'LW';
}

export interface DayTideSummary {
  day: number;
  month: number;
  year: number;
  dayOfWeek: string;
  maxHeight: number;
  minHeight: number;
  rangeMeters: number; // Amplitude de maré (Preamar - Baixa-mar)
  tideType: 'Vivas (Spring)' | 'Mortas (Neap)' | 'Médias (Intermediate)';
  extrema: TideExtreme[];
  minutePoints: MinuteTideData[];
}

// Convert "HH:mm" to minutes from 00:00 (0..1439)
export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Convert minutes from 00:00 to "HH:mm"
export function minutesToTime(totalMinutes: number): string {
  const normalized = ((Math.floor(totalMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Find day prediction in table
export function getDayPrediction(year: number, month: number, day: number): DayTidePrediction | undefined {
  return BEIRA_TIDES_2026.find(d => d.year === year && d.month === month && d.day === day);
}

// Get flattened continuous timestamp points for continuous boundary interpolation
interface AbsoluteExtreme {
  absMinute: number; // relative to target day start (can be negative for previous day, > 1440 for next day)
  height: number;
  type: 'HW' | 'LW';
  timeLabel: string;
}

function getNearbyExtrema(year: number, month: number, day: number): AbsoluteExtreme[] {
  const result: AbsoluteExtreme[] = [];
  
  // Previous day
  let prevMonth = month;
  let prevDay = day - 1;
  let prevYear = year;
  if (prevDay < 1) {
    prevMonth = month - 1;
    if (prevMonth === 8) {
      prevDay = 31; // Aug
    } else if (prevMonth === 9) {
      prevDay = 30; // Sep
    } else if (prevMonth === 10) {
      prevDay = 31; // Oct
    } else if (prevMonth === 11) {
      prevDay = 30; // Nov
    }
  }
  const prevData = getDayPrediction(prevYear, prevMonth, prevDay);
  if (prevData) {
    prevData.extrema.forEach(e => {
      result.push({
        absMinute: timeToMinutes(e.time) - 1440,
        height: e.height,
        type: e.type,
        timeLabel: `${e.time} (-1d)`
      });
    });
  }

  // Current day
  const currData = getDayPrediction(year, month, day);
  if (currData) {
    currData.extrema.forEach(e => {
      result.push({
        absMinute: timeToMinutes(e.time),
        height: e.height,
        type: e.type,
        timeLabel: e.time
      });
    });
  }

  // Next day
  let nextMonth = month;
  let nextDay = day + 1;
  let nextYear = year;
  const daysInMonth = (month === 9 || month === 11) ? 30 : 31;
  if (nextDay > daysInMonth) {
    nextDay = 1;
    nextMonth = month + 1;
  }
  const nextData = getDayPrediction(nextYear, nextMonth, nextDay);
  if (nextData) {
    nextData.extrema.forEach(e => {
      result.push({
        absMinute: timeToMinutes(e.time) + 1440,
        height: e.height,
        type: e.type,
        timeLabel: `${e.time} (+1d)`
      });
    });
  }

  // Fallback synthesis if boundary extremes missing (e.g. at edges of full dataset)
  if (result.length > 0 && currData) {
    const first = result[0];
    if (first.absMinute > 0) {
      // Synthesize previous extreme roughly 6h 12m earlier with alternate type
      const oppType = currData.extrema[0].type === 'HW' ? 'LW' : 'HW';
      const avgOppHeight = oppType === 'HW' ? 5.8 : 1.2;
      result.unshift({
        absMinute: currData.extrema[0] ? timeToMinutes(currData.extrema[0].time) - 372 : -372,
        height: avgOppHeight,
        type: oppType,
        timeLabel: 'Extrapolado Ant.'
      });
    }

    const last = result[result.length - 1];
    if (last.absMinute < 1440) {
      const oppType = last.type === 'HW' ? 'LW' : 'HW';
      const avgOppHeight = oppType === 'HW' ? 5.8 : 1.2;
      result.push({
        absMinute: last.absMinute + 372,
        height: avgOppHeight,
        type: oppType,
        timeLabel: 'Extrapolado Seg.'
      });
    }
  }

  return result.sort((a, b) => a.absMinute - b.absMinute);
}

/**
 * Calculates continuous sinusoidal tide height for a single minute
 * Using Admiralty harmonic formula:
 * h(t) = (H1 + H2)/2 + (H1 - H2)/2 * cos(pi * (t - T1) / (T2 - T1))
 */
export function calculateMinuteTide(
  year: number,
  month: number,
  day: number,
  minuteOfDay: number
): MinuteTideData {
  const normMinute = ((minuteOfDay % 1440) + 1440) % 1440;
  const timeStr = minutesToTime(normMinute);
  const extrema = getNearbyExtrema(year, month, day);

  if (extrema.length < 2) {
    return {
      minuteOfDay: normMinute,
      time: timeStr,
      height: 3.5,
      trend: 'estofo_alta',
      trendLabel: 'Estofo',
      rateCmMin: 0,
      rateMetersHour: 0,
      previousExtreme: { time: '00:00', height: 3.5, type: 'HW' },
      nextExtreme: { time: '12:00', height: 3.5, type: 'LW' }
    };
  }

  // Find bounding extrema: e1.absMinute <= normMinute <= e2.absMinute
  let e1 = extrema[0];
  let e2 = extrema[1];

  for (let i = 0; i < extrema.length - 1; i++) {
    if (normMinute >= extrema[i].absMinute && normMinute <= extrema[i + 1].absMinute) {
      e1 = extrema[i];
      e2 = extrema[i + 1];
      break;
    }
  }

  // Handle case if before first extreme or after last
  if (normMinute < extrema[0].absMinute) {
    e1 = extrema[0];
    e2 = extrema[1];
  } else if (normMinute > extrema[extrema.length - 1].absMinute) {
    e1 = extrema[extrema.length - 2];
    e2 = extrema[extrema.length - 1];
  }

  const T1 = e1.absMinute;
  const T2 = e2.absMinute;
  const H1 = e1.height;
  const H2 = e2.height;

  const duration = Math.max(1, T2 - T1);
  const elapsed = normMinute - T1;
  const phase = (Math.PI * elapsed) / duration;

  // Harmonic sinusoidal interpolation (Admiralty continuous formula)
  const meanLevel = (H1 + H2) / 2;
  const amplitude = (H1 - H2) / 2;
  const height = meanLevel + amplitude * Math.cos(phase);

  // Derivative: dh/dt = -amplitude * (pi / duration) * sin(phase)
  // (Note: amplitude = (H1-H2)/2, so if H2 > H1 (rising), amplitude < 0, derivative > 0)
  const rateMetersPerMinute = -amplitude * (Math.PI / duration) * Math.sin(phase);
  const rateCmMin = rateMetersPerMinute * 100;
  const rateMetersHour = rateMetersPerMinute * 60;

  // Determine trend
  let trend: 'enchente' | 'vazante' | 'estofo_alta' | 'estofo_baixa';
  let trendLabel: string;

  if (Math.abs(rateCmMin) < 0.15) {
    // Slack water
    if (H1 > H2) {
      // was ebbing, reached low
      trend = elapsed > duration / 2 ? 'estofo_baixa' : 'estofo_alta';
      trendLabel = elapsed > duration / 2 ? 'Estofo Baixa-mar' : 'Estofo Preamar';
    } else {
      // was flooding, reached high
      trend = elapsed > duration / 2 ? 'estofo_alta' : 'estofo_baixa';
      trendLabel = elapsed > duration / 2 ? 'Estofo Preamar' : 'Estofo Baixa-mar';
    }
  } else if (rateCmMin > 0) {
    trend = 'enchente';
    trendLabel = 'Enchente (A Subir)';
  } else {
    trend = 'vazante';
    trendLabel = 'Vazante (A Descer)';
  }

  // Check if exactly an extreme minute
  const exactMatch = extrema.find(e => e.absMinute === normMinute);

  return {
    minuteOfDay: normMinute,
    time: timeStr,
    height: Math.round(height * 100) / 100,
    trend,
    trendLabel,
    rateCmMin: Math.round(rateCmMin * 10) / 10,
    rateMetersHour: Math.round(rateMetersHour * 100) / 100,
    previousExtreme: {
      time: e1.timeLabel,
      height: e1.height,
      type: e1.type
    },
    nextExtreme: {
      time: e2.timeLabel,
      height: e2.height,
      type: e2.type
    },
    isExtreme: !!exactMatch,
    extremeType: exactMatch?.type
  };
}

/**
 * Calculates all 1,440 minutes of a specific day
 */
export function calculateDayTideSummary(year: number, month: number, day: number): DayTideSummary {
  const dayPrediction = getDayPrediction(year, month, day);
  const extrema = dayPrediction?.extrema || [];

  const minutePoints: MinuteTideData[] = [];
  let maxHeight = 0;
  let minHeight = 999;

  for (let m = 0; m < 1440; m++) {
    const minData = calculateMinuteTide(year, month, day, m);
    minutePoints.push(minData);
    if (minData.height > maxHeight) maxHeight = minData.height;
    if (minData.height < minHeight) minHeight = minData.height;
  }

  const rangeMeters = Math.round((maxHeight - minHeight) * 100) / 100;

  // Classify tide range for Beira (Springs can exceed 6m range; Neaps ~2-3m)
  let tideType: 'Vivas (Spring)' | 'Mortas (Neap)' | 'Médias (Intermediate)';
  if (rangeMeters >= 4.5) {
    tideType = 'Vivas (Spring)';
  } else if (rangeMeters <= 2.8) {
    tideType = 'Mortas (Neap)';
  } else {
    tideType = 'Médias (Intermediate)';
  }

  return {
    day,
    month,
    year,
    dayOfWeek: dayPrediction?.dayOfWeek || '---',
    maxHeight,
    minHeight,
    rangeMeters,
    tideType,
    extrema,
    minutePoints
  };
}

/**
 * Calculates Under-Keel Clearance (Folga Sob a Quilha)
 */
export function calculateUKC(
  chartDepth: number,
  tideHeight: number,
  vesselDraft: number,
  squatMargin: number = 0.3
): {
  totalWaterDepth: number;
  grossUKC: number;
  netUKC: number;
  isSafe: boolean;
  statusMessage: string;
} {
  const totalWaterDepth = Math.round((chartDepth + tideHeight) * 100) / 100;
  const grossUKC = Math.round((totalWaterDepth - vesselDraft) * 100) / 100;
  const netUKC = Math.round((grossUKC - squatMargin) * 100) / 100;

  let isSafe = netUKC >= 1.0; // Standard 1.0m minimum safety UKC for Beira access channels
  let statusMessage = '';

  if (netUKC >= 1.5) {
    statusMessage = 'Navegação Segura (UKC Adequada)';
  } else if (netUKC >= 1.0) {
    statusMessage = 'Atenção: Margem Mínima Regulamentar';
  } else if (netUKC >= 0) {
    statusMessage = 'Crítico: Risco Elevado de Toque no Fundo';
    isSafe = false;
  } else {
    statusMessage = 'Impraticável: Calado Excede Altura de Água (Encalhe Certo)';
    isSafe = false;
  }

  return {
    totalWaterDepth,
    grossUKC,
    netUKC,
    isSafe,
    statusMessage
  };
}

/**
 * Exports minute-by-minute tidal height data to CSV
 */
export function exportMinuteTideToCSV(summary: DayTideSummary): string {
  const headers = [
    'Porto',
    'Data',
    'Hora (HH:mm)',
    'Minuto do Dia',
    'Altura Maré (m)',
    'Estado Maré',
    'Variação (cm/min)',
    'Taxa Horária (m/h)',
    'Extremo Anterior',
    'Próximo Extremo'
  ];

  const dateStr = `${summary.year}-${summary.month.toString().padStart(2, '0')}-${summary.day.toString().padStart(2, '0')}`;

  const rows = summary.minutePoints.map(m => [
    'Porto da Beira (ZH)',
    dateStr,
    m.time,
    m.minuteOfDay,
    m.height.toFixed(2),
    m.trendLabel,
    m.rateCmMin.toFixed(1),
    m.rateMetersHour.toFixed(2),
    `${m.previousExtreme.type} ${m.previousExtreme.height}m (${m.previousExtreme.time})`,
    `${m.nextExtreme.type} ${m.nextExtreme.height}m (${m.nextExtreme.time})`
  ]);

  return [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
}
