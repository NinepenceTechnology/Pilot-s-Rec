import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Vessel, 
  ManeuverRecord, 
  Pilot, 
  PilotShift, 
  PortTerminal, 
  WeatherCondition,
  TimeMilestones,
  IncidentRecord,
  UserPilotProfile,
  PilotRank,
  MaritimeAlert
} from '../types/maritime';
import { 
  INITIAL_VESSELS, 
  INITIAL_MANEUVERS, 
  INITIAL_PILOTS, 
  INITIAL_SHIFTS, 
  INITIAL_TERMINALS, 
  INITIAL_WEATHER,
  INITIAL_ALERTS
} from '../data/initialData';
import { exportManeuversToExcel, exportFullJsonBackup } from '../utils/excelImportExport';
import { Language, Translations, TRANSLATIONS } from '../utils/translations';

export type AppView = 
  | 'dashboard' 
  | 'operacoes' 
  | 'saude'
  | 'alertas'
  | 'mares'
  | 'arquivo'
  | 'testes'
  | 'navios' 
  | 'pilotos' 
  | 'cancelamentos' 
  | 'performance' 
  | 'seguranca' 
  | 'relatorios'
  | 'mobile_quicklog';

interface MaritimeContextType {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof Translations) => string;
  vessels: Vessel[];
  maneuvers: ManeuverRecord[];
  pilots: Pilot[];
  shifts: PilotShift[];
  terminals: PortTerminal[];
  weather: WeatherCondition;
  alerts: MaritimeAlert[];
  isMobileHudOpen: boolean;
  setIsMobileHudOpen: (open: boolean) => void;
  selectedManeuverId: string | null;
  setSelectedManeuverId: (id: string | null) => void;
  activePilotId: string;
  setActivePilotId: (id: string) => void;
  currentUser: UserPilotProfile | null;
  isProfileModalOpen: boolean;
  setIsProfileModalOpen: (open: boolean) => void;
  registerUser: (profile: Omit<UserPilotProfile, 'id' | 'registeredAt'>) => void;
  updateUserProfile: (updates: Partial<UserPilotProfile>) => void;
  logoutUser: () => void;
  
  // Actions
  addManeuver: (maneuver: Omit<ManeuverRecord, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateManeuver: (id: string, updates: Partial<ManeuverRecord>) => void;
  deleteManeuver: (id: string) => void;
  updateMilestone: (maneuverId: string, milestoneKey: keyof TimeMilestones, timeString?: string) => void;
  completeManeuver: (maneuverId: string, remarks?: string) => void;
  cancelManeuverWithIncident: (maneuverId: string, incident: IncidentRecord, remarks?: string) => void;
  addVessel: (vessel: Omit<Vessel, 'id'>) => string;
  updateVessel: (id: string, updates: Partial<Vessel>) => void;
  addPilot: (pilot: Omit<Pilot, 'id' | 'completedManeuversCount'>) => string;
  updatePilotStatus: (pilotId: string, status: Pilot['status']) => void;
  updateWeather: (weather: Partial<WeatherCondition>) => void;
  
  // Alertas
  addAlert: (alert: Omit<MaritimeAlert, 'id' | 'issuedAt'>) => string;
  updateAlert: (id: string, updates: Partial<MaritimeAlert>) => void;
  toggleAlertActive: (id: string) => void;
  deleteAlert: (id: string) => void;

  resetAllData: () => void;
  exportManeuversToCsv: () => void;
  exportIncidentsToCsv: () => void;
  exportManeuversToXlsx: () => void;
  exportFullBackup: () => void;
  importManeuversBatch: (imported: ManeuverRecord[]) => number;
  restoreFullBackup: (data: any) => boolean;
}

const MaritimeContext = createContext<MaritimeContextType | undefined>(undefined);

const STORAGE_KEYS = {
  VESSELS: 'pilots_records_vessels_v2',
  MANEUVERS: 'pilots_records_maneuvers_v2',
  PILOTS: 'pilots_records_pilots_v2',
  SHIFTS: 'pilots_records_shifts_v2',
  WEATHER: 'pilots_records_weather_v2',
  ALERTS: 'pilots_records_alerts_v2',
  USER_PROFILE: 'pilots_records_user_profile_v2'
};

// Purge any pre-existing v1 mock data from browser localStorage to start cleanly from zero
try {
  ['pilots_records_vessels_v1', 'pilots_records_maneuvers_v1', 'pilots_records_pilots_v1', 'pilots_records_shifts_v1', 'pilots_records_weather_v1'].forEach(k => {
    localStorage.removeItem(k);
  });
} catch {
  // Ignore in SSR/sandbox
}

export const MaritimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('pilots_records_lang');
      if (saved === 'en' || saved === 'pt') return saved;
    } catch {}
    return 'pt';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('pilots_records_lang', lang);
    } catch {}
  };

  const t = (key: keyof Translations): string => {
    return TRANSLATIONS[language]?.[key] || TRANSLATIONS.pt[key] || key;
  };

  const [isMobileHudOpen, setIsMobileHudOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedManeuverId, setSelectedManeuverId] = useState<string | null>(null);
  const [activePilotId, setActivePilotId] = useState<string>('');

  // Load logged-in pilot / user profile
  const [currentUser, setCurrentUser] = useState<UserPilotProfile | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Load from localStorage or default
  const [vessels, setVessels] = useState<Vessel[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.VESSELS);
      return saved ? JSON.parse(saved) : INITIAL_VESSELS;
    } catch {
      return INITIAL_VESSELS;
    }
  });

  const [maneuvers, setManeuvers] = useState<ManeuverRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MANEUVERS);
      return saved ? JSON.parse(saved) : INITIAL_MANEUVERS;
    } catch {
      return INITIAL_MANEUVERS;
    }
  });

  const [pilots, setPilots] = useState<Pilot[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PILOTS);
      const parsed: Pilot[] = saved ? JSON.parse(saved) : INITIAL_PILOTS;
      // If user is already registered, ensure user exists in pilots
      const savedUserStr = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      if (savedUserStr) {
        const u: UserPilotProfile = JSON.parse(savedUserStr);
        if (!parsed.some(p => p.id === u.id || p.name.toLowerCase() === u.name.toLowerCase())) {
          parsed.unshift({
            id: u.id,
            name: u.name,
            licenseNumber: u.licenseNumber,
            category: u.rank,
            phone: u.phone || '',
            vhfCallSign: u.vhfCallSign || `Prático ${u.name.split(' ').pop() || 'Serviço'}`,
            status: 'de_servico',
            currentShift: 'Manhã/Tarde (08h-16h)',
            completedManeuversCount: 0,
            avatarColor: 'bg-blue-900'
          });
        }
      }
      return parsed;
    } catch {
      return INITIAL_PILOTS;
    }
  });

  const [shifts, setShifts] = useState<PilotShift[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SHIFTS);
      return saved ? JSON.parse(saved) : INITIAL_SHIFTS;
    } catch {
      return INITIAL_SHIFTS;
    }
  });

  const [weather, setWeather] = useState<WeatherCondition>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.WEATHER);
      return saved ? JSON.parse(saved) : INITIAL_WEATHER;
    } catch {
      return INITIAL_WEATHER;
    }
  });

  const [alerts, setAlerts] = useState<MaritimeAlert[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ALERTS);
      return saved ? JSON.parse(saved) : INITIAL_ALERTS;
    } catch {
      return INITIAL_ALERTS;
    }
  });

  const [terminals] = useState<PortTerminal[]>(INITIAL_TERMINALS);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(alerts));
    } catch (e) {
      console.error(e);
    }
  }, [alerts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.VESSELS, JSON.stringify(vessels));
    } catch (e) {
      console.error(e);
    }
  }, [vessels]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MANEUVERS, JSON.stringify(maneuvers));
    } catch (e) {
      console.error(e);
    }
  }, [maneuvers]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PILOTS, JSON.stringify(pilots));
    } catch (e) {
      console.error(e);
    }
  }, [pilots]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shifts));
    } catch (e) {
      console.error(e);
    }
  }, [shifts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.WEATHER, JSON.stringify(weather));
    } catch (e) {
      console.error(e);
    }
  }, [weather]);

  const addManeuver = (maneuverData: Omit<ManeuverRecord, 'id' | 'createdAt' | 'updatedAt'>): string => {
    const sequenceNumber = maneuvers.length + 1;
    const padded = String(sequenceNumber).padStart(4, '0');
    const newId = `MNV-2026-${padded}`;
    const now = new Date().toISOString();

    const newManeuver: ManeuverRecord = {
      ...maneuverData,
      id: newId,
      createdAt: now,
      updatedAt: now
    };

    setManeuvers(prev => [newManeuver, ...prev]);

    // If assigned pilot is in active maneuver, update pilot status
    if (maneuverData.status === 'em_curso') {
      setPilots(prev => prev.map(p => p.id === maneuverData.pilotId ? { ...p, status: 'em_manobra' } : p));
    }

    return newId;
  };

  const updateManeuver = (id: string, updates: Partial<ManeuverRecord>) => {
    setManeuvers(prev => prev.map(m => {
      if (m.id === id) {
        return {
          ...m,
          ...updates,
          updatedAt: new Date().toISOString()
        };
      }
      return m;
    }));
  };

  const updateMilestone = (maneuverId: string, milestoneKey: keyof TimeMilestones, timeString?: string) => {
    const timeVal = timeString || new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    setManeuvers(prev => prev.map(m => {
      if (m.id === maneuverId) {
        const updatedMilestones = {
          ...m.milestones,
          [milestoneKey]: timeVal
        };

        let newStatus = m.status;
        if (milestoneKey === 'boardingPilotBoat' || milestoneKey === 'pilotOnBoard' || milestoneKey === 'commenceManeuver') {
          if (m.status === 'programada') newStatus = 'em_curso';
        }

        return {
          ...m,
          status: newStatus,
          milestones: updatedMilestones,
          updatedAt: new Date().toISOString()
        };
      }
      return m;
    }));
  };

  const completeManeuver = (maneuverId: string, remarks?: string) => {
    const nowTime = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    setManeuvers(prev => prev.map(m => {
      if (m.id === maneuverId) {
        return {
          ...m,
          status: 'concluida',
          durationMinutes: m.durationMinutes || 75,
          milestones: {
            ...m.milestones,
            allFastCompleted: m.milestones.allFastCompleted || nowTime,
            pilotDisembarked: m.milestones.pilotDisembarked || nowTime
          },
          pilotRemarks: remarks !== undefined ? remarks : m.pilotRemarks,
          pilotageCertificateSigned: true,
          updatedAt: new Date().toISOString()
        };
      }
      return m;
    }));

    // Update pilot status back to 'de_servico' and increment count
    const maneuver = maneuvers.find(m => m.id === maneuverId);
    if (maneuver) {
      setPilots(prev => prev.map(p => p.id === maneuver.pilotId ? { 
        ...p, 
        status: 'de_servico',
        completedManeuversCount: p.completedManeuversCount + 1 
      } : p));
    }
  };

  const cancelManeuverWithIncident = (maneuverId: string, incident: IncidentRecord, remarks?: string) => {
    setManeuvers(prev => prev.map(m => {
      if (m.id === maneuverId) {
        return {
          ...m,
          status: 'cancelada',
          incident,
          pilotRemarks: remarks || m.pilotRemarks,
          updatedAt: new Date().toISOString()
        };
      }
      return m;
    }));

    const maneuver = maneuvers.find(m => m.id === maneuverId);
    if (maneuver) {
      setPilots(prev => prev.map(p => p.id === maneuver.pilotId ? { ...p, status: 'de_servico' } : p));
    }
  };

  const addVessel = (vesselData: Omit<Vessel, 'id'>): string => {
    const newId = `vess-${Date.now().toString().slice(-4)}`;
    const newVessel: Vessel = {
      ...vesselData,
      id: newId
    };
    setVessels(prev => [newVessel, ...prev]);
    return newId;
  };

  const updateVessel = (id: string, updates: Partial<Vessel>) => {
    setVessels(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
  };

  const addPilot = (pilotData: Omit<Pilot, 'id' | 'completedManeuversCount'>): string => {
    const newId = `plt-${Date.now().toString().slice(-3)}`;
    const newPilot: Pilot = {
      ...pilotData,
      id: newId,
      completedManeuversCount: 0
    };
    setPilots(prev => [...prev, newPilot]);
    return newId;
  };

  const registerUser = (profileData: Omit<UserPilotProfile, 'id' | 'registeredAt'>) => {
    const newId = `plt-user-${Date.now().toString().slice(-4)}`;
    const fullProfile: UserPilotProfile = {
      ...profileData,
      id: newId,
      registeredAt: new Date().toISOString()
    };
    setCurrentUser(fullProfile);
    setActivePilotId(newId);
    try {
      localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(fullProfile));
    } catch (e) {
      console.error(e);
    }

    // Automatically synchronize or add into the pilots roster
    setPilots(prev => {
      const existing = prev.find(p => p.id === newId || p.name.trim().toLowerCase() === fullProfile.name.trim().toLowerCase());
      if (existing) {
        return prev.map(p => p.id === existing.id ? {
          ...p,
          name: fullProfile.name,
          category: fullProfile.rank,
          licenseNumber: fullProfile.licenseNumber,
          phone: fullProfile.phone || p.phone,
          vhfCallSign: fullProfile.vhfCallSign || p.vhfCallSign
        } : p);
      }
      const newPilotItem: Pilot = {
        id: newId,
        name: fullProfile.name,
        licenseNumber: fullProfile.licenseNumber,
        category: fullProfile.rank,
        phone: fullProfile.phone || '',
        vhfCallSign: fullProfile.vhfCallSign || `Prático ${fullProfile.name.split(' ').pop() || 'Serviço'}`,
        status: 'de_servico',
        currentShift: 'Manhã/Tarde (08h-16h)',
        completedManeuversCount: 0,
        avatarColor: 'bg-blue-900'
      };
      return [newPilotItem, ...prev];
    });
  };

  const updateUserProfile = (updates: Partial<UserPilotProfile>) => {
    setCurrentUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...updates };
      try {
        localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      // Also update pilots roster
      setPilots(pList => pList.map(p => p.id === prev.id ? {
        ...p,
        name: updated.name,
        category: updated.rank,
        licenseNumber: updated.licenseNumber,
        phone: updated.phone !== undefined ? updated.phone : p.phone,
        vhfCallSign: updated.vhfCallSign !== undefined ? updated.vhfCallSign : p.vhfCallSign
      } : p));
      return updated;
    });
  };

  const logoutUser = () => {
    setCurrentUser(null);
    setActivePilotId('');
    try {
      localStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
    } catch (e) {
      console.error(e);
    }
  };

  const updatePilotStatus = (pilotId: string, status: Pilot['status']) => {
    setPilots(prev => prev.map(p => p.id === pilotId ? { ...p, status } : p));
  };

  const updateWeather = (updates: Partial<WeatherCondition>) => {
    setWeather(prev => ({ ...prev, ...updates }));
  };

  const resetAllData = () => {
    setVessels([]);
    setManeuvers([]);
    setPilots([]);
    setShifts([]);
    setWeather(INITIAL_WEATHER);
    try {
      Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
      ['pilots_records_vessels_v1', 'pilots_records_maneuvers_v1', 'pilots_records_pilots_v1', 'pilots_records_shifts_v1', 'pilots_records_weather_v1'].forEach(k => localStorage.removeItem(k));
    } catch (e) {
      console.error(e);
    }
    // Also reset current user registration so clean slate
    setCurrentUser(null);
    setActivePilotId('');
  };

  const exportManeuversToCsv = () => {
    const headers = [
      'ID_Manobra',
      'Navio',
      'IMO',
      'Tipo_Navio',
      'Bandeira',
      'LOA_m',
      'Boca_m',
      'Calado_Vante_m',
      'Calado_Re_m',
      'Agente',
      'Tipo_Operacao',
      'Status',
      'Data_Hora_Agendada',
      'Berco_Destino',
      'Pratico_Responsavel',
      'Duracao_Minutos',
      'Qtd_Rebocadores',
      'Causa_Cancelamento'
    ];

    const rows = maneuvers.map(m => [
      m.id,
      `"${m.vesselSnapshot.name}"`,
      m.vesselSnapshot.imo,
      m.vesselSnapshot.type,
      m.vesselSnapshot.flag,
      m.vesselSnapshot.loa,
      m.vesselSnapshot.beam,
      m.vesselSnapshot.draftFwd,
      m.vesselSnapshot.draftAft,
      `"${m.vesselSnapshot.agent}"`,
      m.maneuverType,
      m.status,
      m.scheduledTime,
      `"${m.berthTo}"`,
      `"${m.pilotName}"`,
      m.durationMinutes || '',
      m.tugs.length,
      m.incident ? `"${m.incident.causeTitle}"` : ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' 
      + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Pilot_Records_Manobras_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const deleteManeuver = (id: string) => {
    setManeuvers(prev => prev.filter(m => m.id !== id));
  };

  // Alertas Portuários
  const addAlert = (alertData: Omit<MaritimeAlert, 'id' | 'issuedAt'>): string => {
    const id = `alt-${Date.now().toString().slice(-6)}`;
    const newAlert: MaritimeAlert = {
      ...alertData,
      id,
      issuedAt: new Date().toISOString()
    };
    setAlerts(prev => [newAlert, ...prev]);
    return id;
  };

  const updateAlert = (id: string, updates: Partial<MaritimeAlert>) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const toggleAlertActive = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, isActive: !a.isActive } : a));
  };

  const deleteAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  // Import / Export Excel (.xlsx) & Backup JSON
  const exportManeuversToXlsx = () => {
    exportManeuversToExcel(maneuvers);
  };

  const exportFullBackup = () => {
    exportFullJsonBackup({
      maneuvers,
      vessels,
      pilots,
      alerts,
      shifts
    });
  };

  const importManeuversBatch = (imported: ManeuverRecord[]): number => {
    let addedCount = 0;
    setManeuvers(prev => {
      const existingIds = new Set(prev.map(m => m.id));
      const newItems: ManeuverRecord[] = [];
      imported.forEach(item => {
        let finalItem = item;
        if (existingIds.has(finalItem.id)) {
          finalItem = { ...finalItem, id: `${finalItem.id}_IMP` };
        }
        existingIds.add(finalItem.id);
        newItems.push(finalItem);
        addedCount++;
      });
      return [...newItems, ...prev];
    });
    return addedCount;
  };

  const restoreFullBackup = (data: any): boolean => {
    try {
      if (Array.isArray(data.maneuvers)) setManeuvers(data.maneuvers);
      if (Array.isArray(data.vessels)) setVessels(data.vessels);
      if (Array.isArray(data.pilots)) setPilots(data.pilots);
      if (Array.isArray(data.alerts)) setAlerts(data.alerts);
      if (Array.isArray(data.shifts)) setShifts(data.shifts);
      return true;
    } catch (e) {
      console.error('Erro ao restaurar backup:', e);
      return false;
    }
  };

  const exportIncidentsToCsv = () => {
    const cancelled = maneuvers.filter(m => m.incident);
    const headers = [
      'ID_Manobra',
      'Navio',
      'IMO',
      'Data_Ocorrencia',
      'Causa',
      'Descricao_Impacto',
      'Tempo_Perdido_Horas',
      'Custo_Adicional_EUR',
      'Canal_VHF',
      'Autoridade_Notificada'
    ];

    const rows = cancelled.map(m => [
      m.id,
      `"${m.vesselSnapshot.name}"`,
      m.vesselSnapshot.imo,
      m.incident?.loggedAt || m.scheduledTime,
      `"${m.incident?.causeTitle}"`,
      `"${m.incident?.description.replace(/"/g, '""')}"`,
      m.incident?.delayHours || 0,
      m.incident?.estimatedExtraCost || 0,
      `"${m.incident?.vhfChannelUsed}"`,
      m.incident?.reportedToAuthority ? 'SIM' : 'NÃO'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' 
      + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Pilot_Records_Ocorrencias_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <MaritimeContext.Provider
      value={{
        currentView,
        setCurrentView,
        language,
        setLanguage,
        t,
        vessels,
        maneuvers,
        pilots,
        shifts,
        terminals,
        weather,
        alerts,
        isMobileHudOpen,
        setIsMobileHudOpen,
        selectedManeuverId,
        setSelectedManeuverId,
        activePilotId,
        setActivePilotId,
        currentUser,
        isProfileModalOpen,
        setIsProfileModalOpen,
        registerUser,
        updateUserProfile,
        logoutUser,
        addManeuver,
        updateManeuver,
        deleteManeuver,
        updateMilestone,
        completeManeuver,
        cancelManeuverWithIncident,
        addVessel,
        updateVessel,
        addPilot,
        updatePilotStatus,
        updateWeather,
        addAlert,
        updateAlert,
        toggleAlertActive,
        deleteAlert,
        resetAllData,
        exportManeuversToCsv,
        exportIncidentsToCsv,
        exportManeuversToXlsx,
        exportFullBackup,
        importManeuversBatch,
        restoreFullBackup
      }}
    >
      {children}
    </MaritimeContext.Provider>
  );
};

export const useMaritime = () => {
  const context = useContext(MaritimeContext);
  if (!context) {
    throw new Error('useMaritime must be used within a MaritimeProvider');
  }
  return context;
};
