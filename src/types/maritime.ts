export type VesselType = 
  | 'porta_conteiner'
  | 'petroleiro'
  | 'graneleiro'
  | 'gasoso_gnl_glp'
  | 'quimico'
  | 'ro_ro_veiculos'
  | 'carga_geral'
  | 'passageiros_cruzeiro'
  | 'apoio_maritimo';

export interface Vessel {
  id: string;
  name: string;
  imo: string;
  callSign: string;
  flag: string;
  flagCode: string;
  type: VesselType;
  loa: number; // Length Overall in meters (Comprimento)
  beam: number; // Boca / Largura in meters
  maxDraft: number; // Calado máximo in meters
  currentDraftFwd: number; // Calado Vante
  currentDraftAft: number; // Calado Ré
  agent: string; // Agente Marítimo
  origin: string; // Procedência
  destination: string; // Próximo Porto
  dwt: number; // Deadweight tonnage
  grossTonnage: number; // GRT (Arqueação Bruta)
  terminalPreference?: string;
  yearBuilt?: number;
  remarks?: string;
}

// User requested exact types: ATRACAÇÃO, MUDANÇA, PUXANÇA, DESATRACAÇÃO
export type ManeuverType = 
  | 'atracacao'
  | 'mudanca'
  | 'puxanca'
  | 'desatracacao'
  | 'entrada'
  | 'saida'
  | 'mudanca_cais'
  | 'fundeio'
  | 'desfundeio'
  | 'barra_entrada'
  | 'barra_saida';

export type ManeuverStatus = 'programada' | 'em_curso' | 'concluida' | 'cancelada';

export type BerthingModel = 
  | 'Costado Bombordo (BB)'
  | 'Costado Boreste (BE)'
  | 'Mediterrânea (Popa)'
  | 'Amarras / Bóias'
  | 'Dolphin / Terminal';

export interface TugAssistanceTimings {
  arranque?: string; // Horário de saída / mobilização
  inicio?: string;   // Horário de início do trabalho com cabos
  fim?: string;      // Horário de término da assistência
}

export interface TugAssistance {
  tugId: string;
  tugName: string;
  bollardPullTons: number;
  linePassedTime?: string;
  lineReleasedTime?: string;
  hoursAssisted: number;
  position: 'proa' | 'popa' | 'costado_bb' | 'costado_be' | 'escolta';
  timings?: TugAssistanceTimings;
}

export interface WeatherCondition {
  windSpeedKnots: number;
  windDirection: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
  seaState: 'Calmo (1)' | 'Chop moderado (2-3)' | 'Mar agitado (4-5)' | 'Mar muito grosso (6+)';
  tideState: 'enchente' | 'vazante' | 'estofo_alta' | 'estofo_baixa';
  tideHeightMeters: number;
  visibilityMiles: number;
  currentKnots: number;
  barometricPressureHpa: number;
  weatherSummary: string;
}

export interface SafetyChecklist {
  pilotLadderCompliant: boolean; // Escada de Piloto IMO/SOLAS
  steeringGearTested: boolean; // Máquina do leme testada
  bowThrusterOperational: boolean; // Propulsor de proa
  mainEngineTested: boolean; // Máquina principal avante/ré
  anchorsCleared: boolean; // Ferros prontos a largar
  radarEcdisOperational: boolean; // Radares e Carta Eletrônica
  vhfChannelsConfirmed: boolean; // VHF Ch 12/16 operacionais
  masterPilotExchangeDone: boolean; // MPX preenchido
  deckCrewAssisting: boolean; // Tripulação a postos nos cabos
}

export interface TimeMilestones {
  boardingPilotBoat?: string; // Saída da lancha / Embarque
  pilotOnBoard?: string; // Piloto a bordo (Início de assessoria)
  commenceManeuver?: string; // Largar ferro ou soltar amarras
  tugsConnected?: string; // Rebocadores passados
  firstLineAshored?: string; // Primeiro cabo em terra
  allFastCompleted?: string; // Amarrado e finalizado
  pilotDisembarked?: string; // Desembarque do piloto
}

export interface IncidentRecord {
  cause: 
    | 'mau_tempo_vento'
    | 'mar_grosso_ressaca'
    | 'falta_espaco_cais'
    | 'avaria_maquinas'
    | 'avaria_leme'
    | 'restricao_calado_mare'
    | 'falta_rebocadores'
    | 'seguranca_recusa_tecnica'
    | 'acidente_toque'
    | 'outro';
  causeTitle: string;
  description: string;
  delayHours: number;
  estimatedExtraCost: number;
  vhfChannelUsed: string;
  reportedToAuthority: boolean;
  loggedAt: string;
}

export interface ManeuverRecord {
  id: string; // e.g. "PR-2026-0042"
  vesselId: string;
  vesselSnapshot: {
    name: string;
    imo: string;
    flag: string;
    type: VesselType;
    loa: number;
    beam: number;
    draftFwd: number;
    draftAft: number;
    grossTonnage?: number; // GRT
    agent: string;
    origin: string; // Procedência
    destination: string; // Próximo Porto
  };
  maneuverType: ManeuverType;
  status: ManeuverStatus;
  scheduledTime: string; // ISO string
  berthFrom?: string;
  berthTo: string;
  pilotId: string;
  pilotName: string;
  secondPilotId?: string;
  secondPilotName?: string;
  milestones: TimeMilestones;
  durationMinutes?: number;
  maneuverDurationFormatted?: string; // e.g. "1h 35m"
  
  // Pilot Specific Inputs
  firstLineAshored?: string; // PRIMEIRO CABO
  unmooringTime?: string;    // DESATRACAÇÃO
  berthingTime?: string;      // ATRACAÇÃO
  berthingModel?: BerthingModel; // MODELO DE ATRACAÇÃO
  tugCount?: number;          // NÚMERO DE REBOCADORES
  tugTimings?: TugAssistanceTimings; // TEMPO DE ASSISTÊNCIA (ARRANQUE, INÍCIO, FIM)
  
  tugs: TugAssistance[];
  weather: WeatherCondition;
  safetyChecklist: SafetyChecklist;
  incident?: IncidentRecord;
  pilotRemarks?: string; // OBSERVAÇÃO
  masterName?: string;
  pilotageCertificateSigned?: boolean;
  
  // Foto que vira PDF anexado
  photoUrl?: string; // Base64 or ObjectURL of photo
  photoTimestamp?: string;
  photoTitle?: string;
  
  createdAt: string;
  updatedAt: string;
}

export type PilotRank = 
  | 'Piloto Sênior' 
  | 'Piloto Efetivo' 
  | 'Piloto Praticante' 
  | 'Piloto em Treinamento' 
  | 'Piloto Chefe / Coordenador'
  | 'Prático Sênior' 
  | 'Prático Efetivo' 
  | 'Praticante de Prático';

export interface UserPilotProfile {
  id: string;
  name: string;
  rank: PilotRank;
  licenseNumber: string; // CIR Marítima / Licença
  phone?: string;
  vhfCallSign?: string;
  registeredAt: string;
}

export interface Pilot {
  id: string;
  name: string;
  licenseNumber: string; // CIR Marítima
  category: PilotRank | 'Piloto Sênior' | 'Piloto Efetivo' | 'Piloto em Treinamento';
  phone: string;
  vhfCallSign: string;
  status: 'de_servico' | 'prevencao' | 'folga' | 'em_manobra';
  currentShift: string;
  completedManeuversCount: number;
  avatarColor: string;
}

export interface PilotShift {
  id: string;
  pilotId: string;
  pilotName: string;
  date: string;
  shiftName: 'Madrugada (00h-08h)' | 'Manhã/Tarde (08h-16h)' | 'Noite (16h-24h)' | 'Plantão 24h';
  role: 'Serviço Ativo' | 'Prevenção / Reserva' | 'Descanso Obrigatório';
}

export interface PortTerminal {
  id: string;
  name: string;
  code: string;
  berths: string[];
  maxLoa: number;
  maxDraft: number;
  handledTypes: VesselType[];
}

export type AlertSeverity = 'critica' | 'alta' | 'media' | 'baixa';
export type AlertCategory = 'meteorologico' | 'canal_navegacao' | 'berco_porto' | 'operacional' | 'seguranca';

export interface MaritimeAlert {
  id: string;
  title: string;
  category: AlertCategory;
  severity: AlertSeverity;
  location?: string; // e.g. "Canal da Barra", "Cais Comercial 3", "Terminal Petroleiro"
  description: string;
  isActive: boolean; // acionamento (ativar/desativar)
  issuedBy: string; // e.g. "Capitania dos Portos", "VTS Porto", "Coordenação de Pilotagem"
  issuedAt: string; // ISO datetime
  validUntil?: string; // ISO datetime or date
  actionRequired?: string;
}

