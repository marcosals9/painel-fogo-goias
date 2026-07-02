import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as turf from '@turf/turf';
import { MapContainer, TileLayer, WMSTileLayer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { Download, Flame, Map as MapIcon, Loader2, ArrowUpDown, RefreshCw, MousePointerSquareDashed, LocateFixed, Timer, Trees, Smartphone, Database, TableProperties, List, X, MapPinOff, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import InformativoMaker from '../components/InformativoMaker';
import DataExplorer from '../components/DataExplorer';

// Fix for Leaflet icon in React
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix the default Leaflet marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Coordenadas extremas de Goiás (Sudoeste, Nordeste) para enquadramento perfeito
const GOIAS_BOUNDS = [
  [-19.4990, -53.2500],
  [-12.3950, -45.9060]
];

const toCapitalCase = (str) => {
  if (!str || str === 'N/A') return str;
  const lowers = ['de', 'da', 'do', 'das', 'dos', 'e', 'em'];
  return str.toLowerCase().split(' ').map((word, i) => {
    if (i > 0 && lowers.includes(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
};

const getEventColorHex = (ageHours) => {
  if (ageHours === null || ageHours === undefined) return '#737373'; // Default Cinza
  if (ageHours <= 3) return '#8B0000'; // Dark Red
  if (ageHours <= 6) return '#DC2626'; // Red
  if (ageHours <= 12) return '#F97316'; // Orange
  if (ageHours <= 24) return '#F59E0B'; // Amber
  return '#737373'; // Grey
};

// Ícone SVG Customizado para permitir cor dinâmica e marcador de UC
const createPinIcon = (isSelected, isUC, ageHours) => {
  const color = getEventColorHex(ageHours);

  const scale = 0.75;
  const width = 25 * scale;
  const height = 41 * scale;

  // Destaque visual: borda branca mais grossa se selecionado. Se for UC, coloca um ponto branco no meio.
  const strokeColor = isSelected ? '#ffffff' : (isUC ? '#1f2937' : '#ffffff');
  const strokeWidth = isSelected ? '2.5' : (isUC ? '2.0' : '1.5');
  const innerDot = isUC ? `<circle cx="12" cy="12" r="5" fill="#ffffff" opacity="1.0" />` : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="${width}" height="${height}" style="filter: drop-shadow(1px 2px 2px rgba(0,0,0,0.5));">
    <path fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}" d="M12 0C5.373 0 0 5.373 0 12c0 7.333 12 24 12 24s12-16.667 12-24C24 5.373 18.627 0 12 0zm0 17.5c-3.038 0-5.5-2.462-5.5-5.5S8.962 6.5 12 6.5s5.5 2.462 5.5 5.5-2.462 5.5-5.5 5.5z"/>
    ${innerDot}
  </svg>`;

  return L.divIcon({
    html: svg,
    className: 'bg-transparent border-0', // Remove fundo branco padrão do divIcon
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
    popupAnchor: [0, -(height - 5)]
  });
};

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

function MapController({ selectedEvent, sortedEvents, goiasCenter, showUCs, setShowUCs, loadingUCs, showOnlyGoias, setShowOnlyGoias }) {
  const map = useMap();

  useEffect(() => {
    if (selectedEvent) {
      const ev = sortedEvents.find(e => e.id === selectedEvent);
      if (ev) {
        map.flyTo([ev.lat, ev.lng], 10, { animate: true, duration: 1.2 });
      }
    } else {
      map.flyToBounds(GOIAS_BOUNDS, { duration: 1.2 });
    }
  }, [selectedEvent, map, sortedEvents]);

  const handleReset = () => {
    map.flyToBounds(GOIAS_BOUNDS, { duration: 1.5, padding: [10, 10] });
  };

  return (
    <div className="leaflet-top leaflet-right mt-2 mr-2 z-[1000] absolute pointer-events-auto flex flex-col gap-2">
      <Button variant="outline" size="icon" onClick={handleReset} title="Centralizar Mapa em Goiás" className="h-9 w-9 bg-background/95 backdrop-blur-sm shadow-md border-muted-foreground/20 hover:bg-accent flex items-center justify-center p-0">
        <LocateFixed className="w-4 h-4 text-foreground" />
      </Button>
      <Button variant="outline" size="icon" onClick={() => setShowUCs(!showUCs)} title={showUCs ? "Ocultar Unidades de Conservação" : "Mostrar Unidades de Conservação"} className={`h-9 w-9 flex items-center justify-center p-0 shadow-md border ${showUCs ? 'bg-primary border-primary hover:bg-primary/90' : 'bg-background/95 backdrop-blur-sm border-muted-foreground/20 hover:bg-accent'}`}>
        {loadingUCs ? <Loader2 className={`w-4 h-4 animate-spin ${showUCs ? 'text-white' : 'text-muted-foreground'}`} /> : <Trees className={`w-4 h-4 ${showUCs ? 'text-white' : 'text-foreground'}`} />}
      </Button>
      <Button variant="outline" size="icon" onClick={() => setShowOnlyGoias(!showOnlyGoias)} title={showOnlyGoias ? "Mostrar Focos Fora de GO" : "Ocultar Focos Fora de GO"} className={`h-9 w-9 flex items-center justify-center p-0 shadow-md border ${showOnlyGoias ? 'bg-primary border-primary hover:bg-primary/90' : 'bg-background/95 backdrop-blur-sm border-muted-foreground/20 hover:bg-accent'}`}>
        <MapPinOff className={`w-4 h-4 ${showOnlyGoias ? 'text-white' : 'text-foreground'}`} />
      </Button>
      <div title="Dica: Segure SHIFT e arraste o mouse no mapa para dar zoom em uma área específica" className="bg-background/95 backdrop-blur-sm text-foreground border border-muted-foreground/20 rounded-md shadow-md cursor-help flex items-center justify-center h-9 w-9">
        <MousePointerSquareDashed className="w-4 h-4" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [isMakerOpen, setIsMakerOpen] = useState(false);
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  });

  const [timezone, setTimezone] = useState('BRT');
  const [loading, setLoading] = useState(false);
  const [fireEvents, setFireEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(0);
  const [showUCs, setShowUCs] = useState(false); // Inicia oculto a pedido do usuário
  const [loadingUCs, setLoadingUCs] = useState(false);
  const [ucGeoJSON, setUcGeoJSON] = useState(null);
  const [goiasGeoJSON, setGoiasGeoJSON] = useState(null);
  const [isLegendOpen, setIsLegendOpen] = useState(window.innerWidth > 768);
  const [showOnlyGoias, setShowOnlyGoias] = useState(true);

  const mapEventsToRender = useMemo(() => {
    return fireEvents.filter(ev => !showOnlyGoias || ev.isGoias);
  }, [fireEvents, showOnlyGoias]);

  const [sortConfig, setSortConfig] = useState({ key: 'tamanho_ha', direction: 'desc' });

  // Busca o contorno do Estado de Goiás do IBGE ao iniciar
  useEffect(() => {
    fetch('https://servicodados.ibge.gov.br/api/v3/malhas/estados/52?formato=application/vnd.geo+json')
      .then(res => res.json())
      .then(data => setGoiasGeoJSON(data))
      .catch(err => console.error('Erro ao buscar malha de Goiás:', err));
  }, []);

  // Busca as coordenadas das UCs no load da página (Background) para cruzamento espacial
  useEffect(() => {
    if (!ucGeoJSON && !loadingUCs) {
      setLoadingUCs(true);
      const bbox = '-53.25,-19.5,-45.9,-12.4,EPSG:4674';
      const baseUrl = 'https://panorama.sipam.gov.br/geoserver/painel_do_fogo/wfs?service=WFS&version=1.0.0&request=GetFeature&outputFormat=application/json&bbox=' + bbox;

      const req1 = axios.get(`${baseUrl}&typeName=painel_do_fogo:icmbio_unidade_conservacao_federal`);
      const req2 = axios.get(`${baseUrl}&typeName=painel_do_fogo:mma_cnuc_unidade_conservacao`);
      const req3 = axios.get(`${baseUrl}&typeName=painel_do_fogo:mma_cnuc_unidade_conservacao_municipal`);

      Promise.allSettled([req1, req2, req3]).then(results => {
        let features = [];
        results.forEach(res => {
          if (res.status === 'fulfilled' && res.value.data && res.value.data.features) {
            features = [...features, ...res.value.data.features];
          }
        });
        setUcGeoJSON({ type: "FeatureCollection", features });
      }).catch(err => {
        console.error("Erro ao buscar UCs em vetor", err);
      }).finally(() => {
        setLoadingUCs(false);
      });
    }
  }, [showUCs, ucGeoJSON, loadingUCs]);

  const sortedEvents = useMemo(() => {
    let sortableItems = fireEvents.filter(e => e.isGoias !== false);
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        if (aVal === null || aVal === undefined) aVal = '';
        if (bVal === null || bVal === undefined) bVal = '';

        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();

        if (aVal < bVal) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aVal > bVal) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [fireEvents, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const { totalStateEvents, ucStateEvents, locationLabel, totalFocos, ucFocos, areaTotal, areaTotalKm2, ucAreaTotal, ucAreaTotalKm2, cidadesAfetadas } = useMemo(() => {
    let eventsToCount = sortedEvents;
    const totalState = sortedEvents.length;
    const ucState = sortedEvents.filter(e => e.uc).length;
    let label = "Focos Ativos";

    if (selectedEvent) {
      const selectedEvObj = sortedEvents.find(e => e.id === selectedEvent);
      if (selectedEvObj && selectedEvObj.municipio && selectedEvObj.municipio !== 'Buscando...') {
        eventsToCount = sortedEvents.filter(e => e.municipio === selectedEvObj.municipio);
        label = `Focos em ${selectedEvObj.municipio}`;
      } else {
        label = "Foco Selecionado";
      }
    }

    const focos = eventsToCount.length;
    const ucFocosCount = eventsToCount.filter(e => e.uc).length;
    const area = eventsToCount.reduce((acc, curr) => acc + (curr.tamanho_ha || 0), 0);
    const areaKm2 = area / 100; // 1 km² = 100 ha
    
    const ucArea = eventsToCount.filter(e => e.uc).reduce((acc, curr) => acc + (curr.tamanho_ha || 0), 0);
    const ucAreaKm2 = ucArea / 100;

    const cidades = new Set(eventsToCount.map(e => e.municipio).filter(m => m !== 'N/A' && m !== 'Não Mapeado' && m !== 'Desconhecido' && m !== 'Buscando...')).size;

    return {
      totalStateEvents: totalState,
      ucStateEvents: ucState,
      locationLabel: label,
      totalFocos: focos,
      ucFocos: ucFocosCount,
      areaTotal: area.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      areaTotalKm2: areaKm2.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      ucAreaTotal: ucArea.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      ucAreaTotalKm2: ucAreaKm2.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      cidadesAfetadas: cidades
    };
  }, [sortedEvents, selectedEvent]);

  // Coordenadas centrais de Goiás
  const goiasCenter = [-15.8270, -49.8362];

  const fetchFireData = async (selectedDate, tz, skipSync = false, isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      // 1. "Cavalo de Tróia": Se solicitado, insere um registro fantasma no banco
      // O backend na máquina virtual escuta todos os INSERTs. Quando ele vir esse fantasma,
      // ele deleta imediatamente e inicia o download do CENSIPAM daquela data!
      if (!skipSync) {
         supabase.from('eventos_fogo').insert([{
             id_evento: -Date.now(), // IDs negativos são Cavalos de Tróia
             data_referencia: selectedDate,
             municipio: 'SYNC_PENDING',
             uf: '--',
             tamanho_km2: 0,
             geojson: { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} }
         }]).then(({error}) => {
             if (error) console.error("Erro ao solicitar sync fantasma", error);
             else {
                 console.log('Walkie-talkie (fantasma) enviado ao banco!');
                 // Failsafe: Se o servidor demorar muito ou falhar e o broadcast não chegar
                 setTimeout(() => setLoading(false), 45000); 
             }
         });
      }

      // 2. Lemos os dados diretamente do Supabase para evitar bloqueios de proxy/Cloudflare!
      // (A máquina virtual atualizará o banco assim que processar o Broadcast ou o CRON)
      const { data, error } = await supabase
        .from('eventos_fogo')
        .select('*')
        .eq('data_referencia', selectedDate);
        
      if (error) throw error;
      
      if (data && data.length > 0) {
        const features = data.map(row => {
          let feature = row.geojson;
          if (typeof feature === 'string') {
              try { feature = JSON.parse(feature); } catch(e) {}
          }
          return {
            type: "Feature",
            geometry: feature.geometry,
            properties: { ...feature.properties, ...row }
          };
        }).filter(f => f.geometry);

        const mappedEvents = features.map(f => {
          const prop = f.properties;
          const uf = prop.uf || prop.sigla_uf || 'N/A';
          const mun = prop.municipio || prop.nome_municipio || 'N/A';
          
          let lat = prop.lat;
          let lng = prop.lng;
          
          if (lat === undefined || lng === undefined) {
             if (f.geometry && f.geometry.coordinates && f.geometry.coordinates[0]) {
                const firstCoord = f.geometry.coordinates[0][0];
                lng = firstCoord[0];
                lat = firstCoord[1];
             } else {
                lng = 0;
                lat = 0;
             }
          }

          // Calcula a idade do evento de fogo
          let ageHours = null;
          if (prop.dt_maxima) {
            const dt = new Date(prop.dt_maxima);
            const todayStr = new Date().toISOString().split('T')[0];
            
            // Para manter a mesma lógica de tempo de referência de antes
            let endFilter;
            if (tz === 'UTC') {
                endFilter = `${selectedDate}T23:59:59Z`;
            } else {
                const d = new Date(selectedDate);
                d.setUTCDate(d.getUTCDate() + 1);
                endFilter = `${d.toISOString().split('T')[0]}T02:59:59Z`;
            }
            
            const referenceTime = selectedDate === todayStr ? Date.now() : new Date(endFilter).getTime();
            if (!isNaN(dt.getTime())) {
              ageHours = (referenceTime - dt.getTime()) / (1000 * 60 * 60);
            }
          }

          // Conversão Crítica: API do CENSIPAM retorna km². 
          // O painel mostra em hectares, então multiplicamos por 100. (1 km² = 100 ha)
          const tamanhoKm2 = prop.area_total_evento || 0;
          const tamanhoHa = tamanhoKm2 * 100;

          return {
            municipio: mun,
            uf: uf,
            tamanho_ha: tamanhoHa ? parseFloat(tamanhoHa.toFixed(2)) : null,
            duracao_h: prop.persistencia_dias ? parseInt(prop.persistencia_dias) * 24 : null,
            qtd_deteccoes: prop.qtd_deteccoes ? parseInt(prop.qtd_deteccoes, 10) : 0,
            uc: !!prop.nome_unidade_conservacao,
            ucText: toCapitalCase(prop.nome_unidade_conservacao || 'N/A'),
            lat: lat,
            lng: lng,
            dt_minima: prop.dt_minima,
            dt_maxima: prop.dt_maxima,
            ageHours: ageHours,
            id: prop.id_evento || Math.random(),
            geometry: f.geometry,
            atualizado_em: prop.atualizado_em,
            isGoias: uf === 'GO' || uf === 'N/A' // N/A passará pelo crivo do Turf.js a seguir
          };
        });

        setFireEvents(mappedEvents);
      } else {
        setFireEvents([]);
      }
    } catch (error) {
      console.error("Erro ao buscar dados de fogo do backend:", error);
      setFireEvents([]);
    } finally {
      // Só esconde o loading imediatamente se não estivermos esperando a sincronização do servidor
      // E NÃO esconde se for um recarregamento silencioso em background (isSilent)
      if (skipSync && !isSilent) {
        setLoading(false);
      }
    }
  };

  const isFixingRef = useRef(false);

  useEffect(() => {
    if (!fireEvents || fireEvents.length === 0 || isFixingRef.current) return;

    const fixData = async () => {
      isFixingRef.current = true;
      let hasChanges = false;
      const newEvents = fireEvents.map(e => ({ ...e }));

      // 1. Cruzamento Espacial Goiás (Turf.js)
      if (goiasGeoJSON && goiasGeoJSON.features) {
        for (let i = 0; i < newEvents.length; i++) {
          const ev = newEvents[i];
          if (!ev.lat || !ev.lng) continue;
          
          let insideGoias = false;
          const pt = turf.point([ev.lng, ev.lat]);
          
          for (const feature of goiasGeoJSON.features) {
            if (feature.geometry && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon')) {
              if (turf.booleanPointInPolygon(pt, feature)) {
                insideGoias = true;
                break;
              }
            }
          }
          if (ev.isGoias !== insideGoias) {
            ev.isGoias = insideGoias;
            hasChanges = true;
          }
        }
      }

      // 2. Cruzamento Espacial UCs (Correção Local via Turf.js)
      if (ucGeoJSON && ucGeoJSON.features) {
        for (let i = 0; i < newEvents.length; i++) {
          const ev = newEvents[i];
          if (!ev.uc || ev.ucText === 'N/A') {
            const pt = turf.point([ev.lng, ev.lat]);
            for (const feature of ucGeoJSON.features) {
              if (feature.geometry && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon')) {
                if (turf.booleanPointInPolygon(pt, feature)) {
                  ev.ucText = toCapitalCase(feature.properties.nome || feature.properties.nome_uc || 'Unidade de Conservação');
                  ev.uc = true;
                  hasChanges = true;
                  break;
                }
              }
            }
          }
        }
      }

      if (hasChanges) {
        setFireEvents(newEvents);
      }
      isFixingRef.current = false;
    };

    fixData();
  }, [fireEvents, ucGeoJSON, goiasGeoJSON]);

  useEffect(() => {
    fetchFireData(date, timezone, true); // skipSync = true no carregamento inicial para não recriar o banco e disparar realtime
    
    // Auto-refresh via Polling
    let intervalId;
    if (refreshInterval > 0) {
      intervalId = setInterval(() => {
        fetchFireData(date, timezone);
      }, refreshInterval * 60 * 1000);
    }

    // Auto-refresh via Supabase Realtime (WebSockets)
    let realtimeTimeout;
    const channel = supabase
      .channel('focos-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'eventos_fogo' },
        (payload) => {
          console.log('[Realtime] Mudança detectada, aguardando para recarregar tabela silenciosamente...', payload);
          clearTimeout(realtimeTimeout);
          realtimeTimeout = setTimeout(() => {
            fetchFireData(date, timezone, true, true); // skipSync = true, isSilent = true
          }, 1500);
        }
      )
      .subscribe();

    // Listener para o ACK do servidor (Walkie-Talkie)
    const syncChannel = supabase.channel('fogo-sync')
      .on('broadcast', { event: 'sync_finished' }, (payload) => {
        console.log('[Broadcast] Sincronização finalizada pelo servidor', payload);
        setLoading(false);
        fetchFireData(date, timezone, true, true);
      })
      .subscribe();

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (realtimeTimeout) clearTimeout(realtimeTimeout);
      supabase.removeChannel(channel);
      supabase.removeChannel(syncChannel);
    };
  }, [refreshInterval, date, timezone]);

  const exportToExcel = () => {
    const exportData = sortedEvents.map(event => ({
      "Município": event.municipio,
      "UF": event.uf,
      "Tamanho (ha)": event.tamanho_ha || 0,
      "Detecções": event.qtd_deteccoes || 0,
      "Duração (horas)": event.duracao_h || 0,
      "Unidade de Conservação": event.ucText !== 'N/A' ? event.ucText : 'Não',
      "Latitude": event.lat,
      "Longitude": event.lng
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Focos de Calor");
    XLSX.writeFile(wb, `focos_calor_goias_${date}.xlsx`);
  };

  const wmsCqlFilterFrente = useMemo(() => {
    let startFilter, endFilter;
    if (timezone === 'UTC') {
      startFilter = `${date}T00:00:00Z`;
      endFilter = `${date}T23:59:59Z`;
    } else {
      startFilter = `${date}T03:00:00Z`;
      const d = new Date(date);
      d.setUTCDate(d.getUTCDate() + 1);
      endFilter = `${d.toISOString().split('T')[0]}T02:59:59Z`;
    }
    return `BBOX(geom,-53.25,-19.49,-45.90,-12.39) AND dt_deteccao >= '${startFilter}' AND dt_deteccao <= '${endFilter}'`;
  }, [date, timezone]);

  return (
    <>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-start gap-2.5 w-full md:w-auto">
            <Flame className="w-9 h-9 text-primary mt-0.5 drop-shadow-sm shrink-0" />
            <div className="flex flex-col w-full">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex flex-col sm:flex-row sm:items-center gap-2">
                Monitoramento de Focos
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <span className="bg-primary/10 text-primary font-bold text-[10px] tracking-wider uppercase px-2 py-0.5 rounded border border-primary/20 shrink-0">
                  Operação Cerrado Vivo
                </span>
                <span className="text-xs text-muted-foreground font-medium truncate"></span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 w-full md:w-auto">
            <div className="flex items-center gap-2 flex-wrap justify-end w-full sm:w-auto">
              {!!localStorage.getItem('codec_token') && (
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none h-9 gap-2 flex flex-row items-center bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100 hover:text-orange-700 shadow-sm px-2 sm:px-3" onClick={() => setIsMakerOpen(true)} title="Gerar Card Informativo WhatsApp">
                  <Smartphone className="w-4 h-4" /> <span className="hidden md:inline">Informativo WhatsApp</span><span className="md:hidden">WhatsApp</span>
                </Button>
              )}
              <div className="relative flex items-center bg-card border rounded-md shadow-sm pr-2 hover:border-primary/50 transition-colors">
                <Timer className="w-4 h-4 ml-3 text-muted-foreground absolute pointer-events-none" />
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="h-9 pl-9 pr-3 text-sm bg-transparent border-none focus:outline-none focus:ring-0 cursor-pointer text-muted-foreground appearance-none"
                  title="Atualização Automática"
                >
                  <option value={0}>Auto Refresh: OFF</option>
                  <option value={5}>A cada 5 min</option>
                  <option value={15}>A cada 15 min</option>
                  <option value={30}>A cada 30 min</option>
                </select>
              </div>
              <div className="relative flex items-center bg-card border rounded-md shadow-sm hover:border-primary/50 transition-colors flex-1 sm:flex-none min-w-[100px]">
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="h-9 px-3 text-sm bg-transparent border-none focus:outline-none focus:ring-0 cursor-pointer text-muted-foreground font-medium appearance-none w-full"
                  title="Fuso Horário"
                >
                  <option value="BRT">BRT (-3)</option>
                  <option value="UTC">UTC (0)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-9 flex-1 sm:flex-none sm:w-auto min-w-[140px] bg-card shadow-sm cursor-pointer"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => fetchFireData(date, timezone)}
                  disabled={loading}
                  className="h-9 w-9 border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 shadow-sm flex items-center justify-center p-0 shrink-0"
                  title="Sincronizar/Buscar dados atualizados no satélite do CENSIPAM"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-sm border-l-4 border-l-primary">
            <CardContent className="p-4 flex flex-col justify-center">
              <p className="text-sm text-muted-foreground font-medium truncate" title="Total no Estado">Focos Totais (Estado)</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-foreground">{loading ? '...' : totalStateEvents}</p>
              </div>
              <p className="text-[10px] sm:text-xs font-bold text-emerald-700 mt-1">
                UCs: {loading ? '...' : ucStateEvents}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-l-4 border-l-orange-500">
            <CardContent className="p-4 flex flex-col justify-center">
              <p className="text-sm text-muted-foreground font-medium truncate" title={locationLabel}>{locationLabel}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-foreground">{loading ? '...' : totalFocos}</p>
              </div>
              <p className="text-[10px] sm:text-xs font-bold text-emerald-700 mt-1">
                UCs: {loading ? '...' : ucFocos}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-l-4 border-l-red-600">
            <CardContent className="p-4 flex flex-col justify-center">
              <p className="text-sm text-muted-foreground font-medium truncate" title="Área Estimada (ha)">Área Estimada (ha)</p>
              <div className="flex items-baseline gap-2">
                <strong className="text-xl sm:text-2xl font-black tabular-nums">{loading ? '...' : areaTotal}</strong>
                {!loading && <p className="text-xs text-muted-foreground font-medium">({areaTotalKm2} km²)</p>}
              </div>
              <p className="text-[10px] sm:text-xs font-bold text-emerald-700 mt-1">
                UCs: {loading ? '...' : `${ucAreaTotal} ha (${ucAreaTotalKm2} km²)`}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-l-4 border-l-amber-500">
            <CardContent className="p-4 flex flex-col justify-center">
              <p className="text-sm text-muted-foreground font-medium truncate" title="Municípios Atingidos">Municípios Atingidos</p>
              <p className="text-3xl font-bold text-foreground">{loading ? '...' : cidadesAfetadas}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 overflow-hidden flex flex-col h-[600px] border-t-4 border-t-primary shadow-lg">
            <CardHeader className="py-3 px-4 bg-muted/30">
              <CardTitle className="text-lg flex justify-between items-center">
                Visualização Geográfica
                <span className="text-xs font-normal bg-primary/10 text-primary px-2 py-1 rounded">Fonte: CENSIPAM WMS</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 relative">
              <MapContainer
                bounds={GOIAS_BOUNDS}
                boundsOptions={{ padding: [10, 10] }}
                zoomSnap={0.1}
                zoomDelta={0.5}
                scrollWheelZoom={true}
                keyboard={false}
                className="w-full h-full z-0"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Vetores Interativos de UCs do CENSIPAM (Lazy Loaded) */}
                {showUCs && ucGeoJSON && (
                  <GeoJSON
                    data={ucGeoJSON}
                    style={(feature) => {
                      const level = (feature.properties.esfera || feature.properties.administra || '').toLowerCase();
                      let fillColor = '#22c55e'; // green-500 default
                      let color = '#15803d'; // green-700 default border

                      if (level.includes('federal')) {
                        fillColor = '#14532d'; // green-900 (Federal - Mais escuro/intenso)
                        color = '#052e16'; // green-950
                      } else if (level.includes('estadual')) {
                        fillColor = '#22c55e'; // green-500 (Estadual - Médio)
                        color = '#15803d'; // green-700
                      } else if (level.includes('municipal')) {
                        fillColor = '#86efac'; // green-300 (Municipal - Mais claro)
                        color = '#22c55e'; // green-500
                      }

                      return {
                        color: color,
                        weight: 1,
                        fillOpacity: 0.35,
                        fillColor: fillColor
                      };
                    }}
                    onEachFeature={(feature, layer) => {
                      const nome = feature.properties.nome || feature.properties.nome_uc || 'Unidade de Conservação';
                      const tipo = feature.properties.esfera || feature.properties.administra || '';
                      layer.bindPopup(`<strong>${nome}</strong><br/><span class="text-xs opacity-80">${tipo}</span>`);
                    }}
                  />
                )}
                {mapEventsToRender.length > 0 && (
                  <GeoJSON
                    key={`fire-polygons-${mapEventsToRender.length}-${mapEventsToRender[0]?.id || 'empty'}`}
                    data={{
                      type: "FeatureCollection",
                      features: mapEventsToRender.map(ev => ({
                        type: "Feature",
                        geometry: ev.geometry,
                        properties: ev
                      })).filter(f => f.geometry)
                    }}
                    style={(feature) => {
                      const color = getEventColorHex(feature.properties.ageHours);
                      return {
                        color: color,
                        weight: 2,
                        fillColor: color,
                        fillOpacity: 0.5
                      };
                    }}
                  />
                )}

                {mapEventsToRender.map(event => (
                  <Marker
                    key={event.id}
                    position={[event.lat, event.lng]}
                    icon={createPinIcon(selectedEvent === event.id, event.uc, event.ageHours)}
                  >
                    <Popup>
                      <div className="text-sm font-sans space-y-1">
                        <p className="font-bold text-base border-b pb-1 mb-1">{event.municipio}</p>
                        <p className="text-[11px] text-muted-foreground m-0 leading-tight"><span className="font-semibold">Lat:</span> {Number(event.lat).toFixed(6)}</p>
                        <p className="text-[11px] text-muted-foreground mb-1 leading-tight"><span className="font-semibold">Lon:</span> {Number(event.lng).toFixed(6)}</p>
                        <p><span className="font-semibold">Tamanho:</span> {event.tamanho_ha ? `${event.tamanho_ha.toLocaleString('pt-BR')} ha` : 'N/A'}</p>
                        <p><span className="font-semibold">Detecções:</span> {event.qtd_deteccoes}</p>
                        <p><span className="font-semibold">Duração:</span> {event.duracao_h ? `${event.duracao_h} h` : 'N/A'}</p>
                        {event.ucText && event.ucText !== 'N/A' && (
                          <p className="pt-1 mt-1 border-t border-muted/30 text-amber-600"><span className="font-bold">UC:</span> {event.ucText}</p>
                        )}
                        {event.atualizado_em && (
                          <p className="pt-1 mt-1 border-t border-muted/30 text-[11px] text-muted-foreground text-right italic">
                            Atualizado em: {format(new Date(event.atualizado_em), "dd/MM 'às' HH:mm")}
                          </p>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {goiasGeoJSON && (
                  <GeoJSON
                    data={goiasGeoJSON}
                    style={{
                      color: '#3b82f6',
                      weight: 1.5,
                      fillOpacity: 0.05,
                      fillColor: '#3b82f6'
                    }}
                  />
                )}

                <MapController selectedEvent={selectedEvent} sortedEvents={fireEvents} goiasCenter={goiasCenter} showUCs={showUCs} setShowUCs={setShowUCs} loadingUCs={loadingUCs} showOnlyGoias={showOnlyGoias} setShowOnlyGoias={setShowOnlyGoias} />

                {/* Legenda de Detecção de Fogo */}
                <div className="absolute bottom-4 right-4 z-[400] flex flex-col items-end">
                  {!isLegendOpen ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mb-2 shadow-md bg-card/95 hover:bg-accent border-border border transition-all duration-300 flex flex-row items-center justify-center gap-1.5"
                      onClick={() => setIsLegendOpen(true)}
                      title="Mostrar Legenda"
                    >
                      <Info className="h-4 w-4" /> <span>Legenda</span>
                    </Button>
                  ) : (
                    <div className="bg-card/95 backdrop-blur-sm p-3 rounded-md shadow-lg border border-border text-xs w-[240px] transition-all duration-300 animate-in slide-in-from-bottom-5 opacity-100">
                      <div className="flex justify-between items-center mb-3 border-b pb-1">
                        <h4 className="font-bold">Frente de Fogo - 24h</h4>
                        <button className="text-muted-foreground hover:text-foreground transition-colors" onClick={() => setIsLegendOpen(false)}>
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-[#8B0000] border border-black/20 shrink-0"></span> Detecção em até 3 Horas</div>
                        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-[#DC2626] border border-black/20 shrink-0"></span> Detecção entre 3 e 6 horas</div>
                        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-[#F97316] border border-black/20 shrink-0"></span> Detecção entre 6 e 12 horas</div>
                        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-[#F59E0B] border border-black/20 shrink-0"></span> Detecção entre 12 e 24 horas</div>
                        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-[#737373] border border-black/20 shrink-0"></span> Detecção a mais de 24 horas</div>
                      </div>
                      <div className="mt-3 pt-2 border-t text-[10px] text-muted-foreground italic flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full border-[1.5px] border-gray-800 flex items-center justify-center shrink-0"><div className="w-1.5 h-1.5 bg-white rounded-full"></div></div>
                        Focos em Unidade de Conservação
                      </div>
                    </div>
                  )}
                </div>
              </MapContainer>
            </CardContent>
          </Card>

          <Card className="flex flex-col h-[600px] border-t-4 border-t-primary shadow-lg">
            <CardHeader className="py-3 px-4 bg-slate-50 dark:bg-slate-800/40 border-b border-border flex flex-row justify-between items-center">
              <div className="flex flex-col gap-0.5">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Flame className="w-5 h-5 text-primary" /> Eventos de Fogo
                </CardTitle>
                {!loading && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="font-semibold text-foreground">{sortedEvents.length}</span> eventos em Goiás
                    {fireEvents.length > sortedEvents.length && (
                      <> · <span className="text-muted-foreground">{fireEvents.length} no total</span></>
                    )}
                    <br />
                    Período: {date.split('-').reverse().join('/')} das 00:00 às 23:59 ({timezone === 'BRT' ? 'Horário de Brasília' : 'UTC Global'})
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-8 w-8 p-0 flex items-center justify-center bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:text-blue-700 shadow-sm" onClick={() => setIsExplorerOpen(true)} title="Explorador de Dados KML (Detalhado)">
                  <Database className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToExcel}
                  className="h-8 w-8 p-0 flex items-center justify-center bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-700 shadow-sm"
                  title="Exportar para Excel (.xlsx)"
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              {loading ? (
                <div className="flex justify-center items-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-card sticky top-0 z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="cursor-pointer hover:bg-muted text-xs" onClick={() => requestSort('municipio')}>
                        <div className="flex items-center gap-1 whitespace-nowrap">Município <ArrowUpDown className="w-3 h-3" /></div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50 text-xs" onClick={() => requestSort('tamanho_ha')}>
                        <div className="flex items-center gap-1 whitespace-nowrap">Tamanho (ha) {sortConfig.key === 'tamanho_ha' && <ArrowUpDown className="w-3 h-3" />}</div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50 text-xs"
                        onClick={() => requestSort('qtd_deteccoes')}
                        title="Quantidade de registros/pixels de calor detectados por satélite neste foco. Valores altos indicam incêndios de maior gravidade, intensidade ou extensão."
                      >
                        <div className="flex items-center gap-1 whitespace-nowrap">Detecções {sortConfig.key === 'qtd_deteccoes' && <ArrowUpDown className="w-3 h-3" />}</div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50 text-xs" onClick={() => requestSort('duracao_h')}>
                        <div className="flex items-center gap-1 whitespace-nowrap">Duração <ArrowUpDown className="w-3 h-3" /></div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted text-xs" title="Unidade de Conservação" onClick={() => requestSort('uc')}>
                        <div className="flex items-center gap-1 whitespace-nowrap">UC <ArrowUpDown className="w-3 h-3" /></div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedEvents.length > 0 ? sortedEvents.map((event, index) => (
                      <React.Fragment key={event.id || index}>
                        <TableRow
                          className={`cursor-pointer transition-colors ${selectedEvent === event.id ? 'bg-slate-200 dark:bg-slate-800' : 'hover:bg-muted/50'}`}
                          onClick={() => setSelectedEvent(selectedEvent === event.id ? null : event.id)}
                        >
                          <TableCell className="font-medium text-xs">
                            <div className="flex items-center gap-2 min-h-[32px]">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm border border-black/10" style={{ backgroundColor: getEventColorHex(event.ageHours) }} title={event.ageHours ? `Idade: ~${Math.round(event.ageHours)}h` : ''}></span>
                              <span className="whitespace-normal break-words leading-tight">{event.municipio || 'N/A'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-semibold">{event.tamanho_ha ? event.tamanho_ha.toLocaleString('pt-BR') : 'N/A'}</TableCell>
                          <TableCell className="text-xs text-orange-600 font-bold">{event.qtd_deteccoes || 0}</TableCell>
                          <TableCell className="text-xs">{event.duracao_h ? `${event.duracao_h} h` : 'N/A'}</TableCell>
                          <TableCell className="font-medium text-[10px] leading-tight py-2" title={event.ucText !== 'N/A' ? event.ucText : ''}>
                            {event.ucText !== 'N/A' ? <span className="font-bold text-emerald-700">{event.ucText}</span> : 'Não'}
                          </TableCell>
                        </TableRow>
                        {selectedEvent === event.id && (
                          <TableRow className="bg-primary/5 hover:bg-primary/5">
                            <TableCell colSpan={5} className="p-0 border-b-2 border-primary/20">
                              <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs bg-gradient-to-br from-white to-slate-50 shadow-inner">
                                <div className="space-y-1"><strong className="text-muted-foreground uppercase text-[10px] tracking-wider flex items-center gap-1"><MapIcon className="w-3 h-3"/> Localização</strong><p className="font-semibold text-sm">{event.municipio} - {(!event.uf || event.uf === 'N/A') ? 'GO' : event.uf}</p></div>
                                <div className="space-y-1"><strong className="text-muted-foreground uppercase text-[10px] tracking-wider flex items-center gap-1"><LocateFixed className="w-3 h-3"/> Coordenadas</strong><p className="font-medium font-mono text-xs">{event.lat?.toFixed(5)}, {event.lng?.toFixed(5)}</p></div>
                                <div className="space-y-1"><strong className="text-muted-foreground uppercase text-[10px] tracking-wider flex items-center gap-1"><Trees className="w-3 h-3 text-emerald-700"/> Unidade de Conservação</strong><p className={event.ucText !== 'N/A' ? 'font-bold text-emerald-700' : 'font-semibold'}>{event.ucText !== 'N/A' ? event.ucText : 'Nenhuma área protegida atingida'}</p></div>
                                <div className="space-y-1"><strong className="text-muted-foreground uppercase text-[10px] tracking-wider flex items-center gap-1"><Flame className="w-3 h-3 text-orange-500"/> Área Estimada</strong><p className="font-semibold text-sm">{event.tamanho_ha ? `${event.tamanho_ha.toLocaleString('pt-BR')} hectares` : 'N/A'}</p></div>
                                <div className="space-y-1"><strong className="text-muted-foreground uppercase text-[10px] tracking-wider">Qtd. Detecções (Pixels)</strong><p className="font-semibold">{event.qtd_deteccoes || 0} registros de satélite</p></div>
                                <div className="space-y-1"><strong className="text-muted-foreground uppercase text-[10px] tracking-wider flex items-center gap-1"><Timer className="w-3 h-3"/> Duração Total</strong><p className="font-semibold">{event.duracao_h ? `${event.duracao_h} horas` : 'N/A'}</p></div>
                                <div className="space-y-1"><strong className="text-muted-foreground uppercase text-[10px] tracking-wider">Início (Primeira Detecção)</strong><p className="font-medium text-slate-700">{event.dt_minima ? new Date(event.dt_minima).toLocaleString('pt-BR') : '—'}</p></div>
                                <div className="space-y-1"><strong className="text-muted-foreground uppercase text-[10px] tracking-wider">Fim (Última Detecção)</strong><p className="font-medium text-slate-700">{event.dt_maxima ? new Date(event.dt_maxima).toLocaleString('pt-BR') : '—'}</p></div>
                                <div className="space-y-1"><strong className="text-muted-foreground uppercase text-[10px] tracking-wider">Bioma</strong><p className="font-medium">{event.bioma || 'Cerrado'}</p></div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                          Nenhum evento registrado nesta data.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <footer className="mt-8 pt-4 pb-2 border-t border-muted-foreground/20 text-center">
          <p className="text-xs text-muted-foreground font-medium">
            &copy; {new Date().getFullYear()} Painel Fogo Goiás. Todos os direitos reservados. | Versão 1.1.3
          </p>
        </footer>

      </div>

      <InformativoMaker isOpen={isMakerOpen} onClose={() => setIsMakerOpen(false)} fireEvents={sortedEvents} date={date} />
      <DataExplorer isOpen={isExplorerOpen} onClose={() => setIsExplorerOpen(false)} fireEvents={fireEvents} date={date} />
    </>
  );
}
