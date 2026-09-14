import { Vessel, ManeuverRecord, Pilot, PilotShift, PortTerminal, WeatherCondition, MaritimeAlert } from '../types/maritime';

export const INITIAL_WEATHER: WeatherCondition = {
  windSpeedKnots: 16,
  windDirection: 'NE',
  seaState: 'Chop moderado (2-3)',
  tideState: 'enchente',
  tideHeightMeters: 2.85,
  visibilityMiles: 9.5,
  currentKnots: 1.4,
  barometricPressureHpa: 1016,
  weatherSummary: 'Tempo firme, visibilidade boa, maré em enchente com pico previsto para 14:30h (3.1m).'
};

export const INITIAL_TERMINALS: PortTerminal[] = [
  {
    id: 'term-1',
    name: 'Terminal de Contentores (TCON)',
    code: 'TCON',
    berths: ['Berço 101', 'Berço 102', 'Berço 103'],
    maxLoa: 366,
    maxDraft: 15.2,
    handledTypes: ['porta_conteiner']
  },
  {
    id: 'term-2',
    name: 'Terminal de Granéis Líquidos & Óleo (TGL)',
    code: 'TGL',
    berths: ['Pier Petroleiro 1', 'Pier Petroleiro 2', 'Delfim Químico'],
    maxLoa: 330,
    maxDraft: 17.5,
    handledTypes: ['petroleiro', 'gasoso_gnl_glp', 'quimico']
  },
  {
    id: 'term-3',
    name: 'Terminal Graneleiro & Minério (TGM)',
    code: 'TGM',
    berths: ['Cais Graneleiro Norte', 'Cais Carvão & Fertilizantes'],
    maxLoa: 300,
    maxDraft: 16.0,
    handledTypes: ['graneleiro', 'carga_geral']
  },
  {
    id: 'term-4',
    name: 'Cais Comercial e Multiuso (CCM)',
    code: 'CCM',
    berths: ['Cais 01 Multiuso', 'Cais 02 Ro-Ro', 'Terminal de Passageiros'],
    maxLoa: 290,
    maxDraft: 12.0,
    handledTypes: ['carga_geral', 'ro_ro_veiculos', 'passageiros_cruzeiro', 'apoio_maritimo']
  },
  {
    id: 'term-5',
    name: 'Área de Fundeadouro e Barra',
    code: 'FUND',
    berths: ['Fundeadouro Alpha (Interno)', 'Fundeadouro Bravo (Externo)', 'Bóia de Barra'],
    maxLoa: 400,
    maxDraft: 22.0,
    handledTypes: ['porta_conteiner', 'petroleiro', 'graneleiro', 'gasoso_gnl_glp', 'quimico', 'ro_ro_veiculos', 'carga_geral', 'passageiros_cruzeiro', 'apoio_maritimo']
  }
];

// Iniciar do zero: todos os registos limpos
export const INITIAL_VESSELS: Vessel[] = [];

export const INITIAL_PILOTS: Pilot[] = [];

export const INITIAL_SHIFTS: PilotShift[] = [];

export const INITIAL_MANEUVERS: ManeuverRecord[] = [];

export const INITIAL_ALERTS: MaritimeAlert[] = [
  {
    id: 'alt-001',
    title: 'Restrição de Vento - Entrada no Canal da Barra',
    category: 'meteorologico',
    severity: 'alta',
    location: 'Canal de Acesso / Barra Externa',
    description: 'Rajadas previstas acima de 25 nós entre as 14:00 e as 19:00. Manobras de navios porta-contentores com LOA > 300m exigem 2 rebocadores de escolta.',
    isActive: true,
    issuedBy: 'Capitania dos Portos / VTS',
    issuedAt: new Date().toISOString(),
    validUntil: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    actionRequired: 'Verificar prontidão de rebocadores com tração estática > 65T antes do embarque.'
  },
  {
    id: 'alt-002',
    title: 'Trabalhos de Dragagem Hidrográfica',
    category: 'canal_navegacao',
    severity: 'media',
    location: 'Trecho do Berço 102 ao Berço 103',
    description: 'Draga autotransportadora operando no alinhamento das bóias 06 e 08. Velocidade máxima autorizada no canal reduzida para 6 nós.',
    isActive: true,
    issuedBy: 'Administração Portuária',
    issuedAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    validUntil: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    actionRequired: 'Estabelecer contacto de segurança em VHF Ch 12 com a draga a 1 milha de distância.'
  }
];

