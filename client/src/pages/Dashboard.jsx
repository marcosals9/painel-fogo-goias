import { useState, useEffect, useMemo, useRef } from 'react';
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
import { Download, Flame, Map as MapIcon, Loader2, ArrowUpDown, RefreshCw, MousePointerSquareDashed, LocateFixed, Timer, Trees } from 'lucide-react';

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

// Ícone SVG Customizado para permitir cor e tamanho dinâmicos
const createPinIcon = (isSelected, isUC) => {
  let color = '#3b82f6'; // blue-500 padrão
  if (isUC) color = '#f59e0b'; // amber-500 para Unidades de Conservação (mesma cor da tabela)
  if (isSelected) color = '#ef4444'; // red-500 quando selecionado (destaque máximo)
  
  const scale = 0.75; // Reduz o tamanho do pino para 75% do original
  const width = 25 * scale;
  const height = 41 * scale;
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="${width}" height="${height}" style="filter: drop-shadow(1px 2px 2px rgba(0,0,0,0.4));">
    <path fill="${color}" stroke="#ffffff" stroke-width="1.5" d="M12 0C5.373 0 0 5.373 0 12c0 7.333 12 24 12 24s12-16.667 12-24C24 5.373 18.627 0 12 0zm0 17.5c-3.038 0-5.5-2.462-5.5-5.5S8.962 6.5 12 6.5s5.5 2.462 5.5 5.5-2.462 5.5-5.5 5.5z"/>
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

function MapController({ selectedEvent, sortedEvents, goiasCenter, showUCs, setShowUCs, loadingUCs }) {
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
      <Button variant={showUCs ? "default" : "outline"} size="icon" onClick={() => setShowUCs(!showUCs)} title={showUCs ? "Ocultar Unidades de Conservação" : "Mostrar Unidades de Conservação"} className={`h-9 w-9 flex items-center justify-center p-0 shadow-md border ${!showUCs ? 'bg-background/95 backdrop-blur-sm border-muted-foreground/20 hover:bg-accent' : ''}`}>
        {loadingUCs ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Trees className={`w-4 h-4 ${showUCs ? 'text-white' : 'text-foreground'}`} />}
      </Button>
      <div title="Dica: Segure SHIFT e arraste o mouse no mapa para dar zoom em uma área específica" className="bg-background/95 backdrop-blur-sm text-foreground border border-muted-foreground/20 rounded-md shadow-md cursor-help flex items-center justify-center h-9 w-9">
        <MousePointerSquareDashed className="w-4 h-4" />
      </div>
    </div>
  );
}

export default function Dashboard() {
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

  const { totalStateEvents, locationLabel, totalFocos, areaTotal, areaTotalKm2, cidadesAfetadas } = useMemo(() => {
    let eventsToCount = sortedEvents;
    const totalState = sortedEvents.length;
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
    const area = eventsToCount.reduce((acc, curr) => acc + (curr.tamanho_ha || 0), 0);
    const areaKm2 = area / 100; // 1 km² = 100 ha
    const cidades = new Set(eventsToCount.map(e => e.municipio).filter(m => m !== 'N/A' && m !== 'Desconhecido' && m !== 'Buscando...')).size;
    
    return { 
       totalStateEvents: totalState,
       locationLabel: label,
       totalFocos: focos, 
       areaTotal: area.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 
       areaTotalKm2: areaKm2.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
       cidadesAfetadas: cidades 
    };
  }, [sortedEvents, selectedEvent]);

  // Coordenadas centrais de Goiás
  const goiasCenter = [-15.8270, -49.8362];

  const fetchFireData = async (selectedDate, tz) => {
    setLoading(true);
    try {
      const wfsUrl = `https://panorama.sipam.gov.br/geoserver/painel_do_fogo/wfs`;
      
      let startFilter, endFilter;
      if (tz === 'UTC') {
        startFilter = `${selectedDate}T00:00:00Z`;
        endFilter = `${selectedDate}T23:59:59Z`;
      } else {
        // BRT (UTC-3)
        startFilter = `${selectedDate}T03:00:00Z`;
        const d = new Date(selectedDate);
        d.setUTCDate(d.getUTCDate() + 1);
        const nextDateStr = d.toISOString().split('T')[0];
        endFilter = `${nextDateStr}T02:59:59Z`;
      }
      
      const response = await axios.get(wfsUrl, {
        params: {
          service: 'WFS',
          version: '1.0.0',
          request: 'GetFeature',
          typeName: 'painel_do_fogo:mv_evento_filtro',
          outputFormat: 'application/vnd.google-earth.kml+xml',
          maxFeatures: 300,
          CQL_FILTER: `BBOX(geom,-53.25,-19.49,-45.90,-12.39) AND dt_maxima >= '${startFilter}' AND dt_minima <= '${endFilter}'`
        }
      });
      
      if (response.data && response.data.includes('<kml')) {
         const parser = new DOMParser();
         const xmlDoc = parser.parseFromString(response.data, "text/xml");
         const placemarks = xmlDoc.getElementsByTagName("Placemark");
         
         const features = [];
         for (let i = 0; i < placemarks.length; i++) {
             const placemark = placemarks[i];
             const simpleData = placemark.getElementsByTagName("SimpleData");
             const props = {};
             for (let j = 0; j < simpleData.length; j++) {
                 const name = simpleData[j].getAttribute("name");
                 let value = simpleData[j].textContent;
                 
                 if (value && value.includes('[Ljava.lang.')) {
                     value = null;
                 } else {
                     if (value && value.startsWith('{') && value.endsWith('}')) {
                         value = value.slice(1, -1);
                     }
                     if (value === 'NULL') value = null;
                 }
                 props[name] = value;
             }
             
             const coordNode = placemark.getElementsByTagName("coordinates")[0];
             let lat = 0, lng = 0;
             if (coordNode) {
                 const coordsStr = coordNode.textContent.trim().split(' ');
                 if (coordsStr.length > 0) {
                     const firstCoord = coordsStr[0].split(',');
                     if (firstCoord.length >= 2) {
                         lng = parseFloat(firstCoord[0]);
                         lat = parseFloat(firstCoord[1]);
                     }
                 }
             }
             features.push({ properties: props, lat, lng });
         }

         const mappedEvents = features.map(f => {
            const prop = f.properties;
            const uf = prop.sigla_uf || 'N/A';
            const mun = prop.nome_municipio || 'N/A';
            
            return {
               municipio: mun,
               uf: uf,
               tamanho_ha: prop.area_total_evento ? parseFloat(parseFloat(prop.area_total_evento).toFixed(2)) : null,
               duracao_h: prop.persistencia_dias ? parseInt(prop.persistencia_dias) * 24 : null,
               qtd_deteccoes: prop.qtd_deteccoes ? parseInt(prop.qtd_deteccoes, 10) : 0,
               uc: !!prop.nome_unidade_conservacao,
               ucText: prop.nome_unidade_conservacao || 'N/A',
               lat: f.lat,
               lng: f.lng,
               id: prop.id_evento || Math.random(),
               isGoias: uf === 'GO' || uf === 'N/A' // N/A passará pelo crivo do Turf.js a seguir
            };
         });
         
         setFireEvents(mappedEvents);
      } else {
         throw new Error("Formato inválido retornado pelo GeoServer");
      }
    } catch (error) {
      console.error("Erro ao buscar dados de fogo:", error);
    } finally {
      setLoading(false);
    }
  };

  const isFixingRef = useRef(false);

  useEffect(() => {
    if (!fireEvents || fireEvents.length === 0 || isFixingRef.current) return;
    
    const fixData = async () => {
      isFixingRef.current = true;
      let hasChanges = false;
      const newEvents = [...fireEvents];

      // 1. Filtragem Exata de Limites Estaduais (Goiás)
      if (goiasGeoJSON && goiasGeoJSON.features) {
        for (let i = 0; i < newEvents.length; i++) {
          const ev = newEvents[i];
          const pt = turf.point([ev.lng, ev.lat]);
          let insideGoias = false;
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
                   ev.ucText = feature.properties.nome || feature.properties.nome_uc || 'Unidade de Conservação';
                   ev.uc = true;
                   hasChanges = true;
                   break;
                 }
               }
             }
          }
        }
      }
      
      // 3. Geocodificação Reversa para Municípios N/A
      for (let i = 0; i < newEvents.length; i++) {
        const ev = newEvents[i];
        // Só busca município se o evento realmente pertencer a Goiás
        if (ev.isGoias && (ev.municipio === 'N/A' || !ev.municipio)) {
           try {
             ev.municipio = 'Buscando...'; 
             setFireEvents([...newEvents]);
             hasChanges = true;
             
             await new Promise(r => setTimeout(r, 1200));
             const res = await axios.get(`https://nominatim.openstreetmap.org/reverse?lat=${ev.lat}&lon=${ev.lng}&format=json`, {
                 headers: { 'Accept-Language': 'pt-BR' }
             });
             if (res.data && res.data.address) {
               const city = res.data.address.city || res.data.address.town || res.data.address.municipality || res.data.address.village;
               if (city) {
                 ev.municipio = city;
               } else {
                 ev.municipio = 'Desconhecido';
               }
             } else {
                 ev.municipio = 'Desconhecido';
             }
           } catch(e) {
             console.error("Erro na Geocodificação Reversa", e);
             ev.municipio = 'Desconhecido';
           }
        }
      }
      
      if (hasChanges) {
        setFireEvents([...newEvents]);
      }
      isFixingRef.current = false;
    };
    
    fixData();
  }, [fireEvents, ucGeoJSON, goiasGeoJSON]);

  useEffect(() => {
    fetchFireData(date, timezone);
  }, [date, timezone]);

  useEffect(() => {
    if (refreshInterval > 0) {
      const intervalId = setInterval(() => {
        fetchFireData(date);
      }, refreshInterval * 60 * 1000);
      return () => clearInterval(intervalId);
    }
  }, [refreshInterval, date]);

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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Flame className="w-8 h-8 text-primary" />
            Monitoramento de Focos
          </h2>
          <p className="text-muted-foreground">Estado de Goiás - Visualização de Eventos de Fogo</p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <div className="relative flex items-center bg-card border rounded-md shadow-sm pr-2 hover:border-primary/50 transition-colors">
             <Timer className="w-4 h-4 ml-3 text-muted-foreground absolute pointer-events-none" />
             <select 
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="h-10 pl-9 pr-3 text-sm bg-transparent border-none focus:outline-none focus:ring-0 cursor-pointer text-muted-foreground appearance-none"
                title="Atualização Automática"
              >
                <option value={0}>Auto Refresh: OFF</option>
                <option value={5}>A cada 5 min</option>
                <option value={15}>A cada 15 min</option>
                <option value={30}>A cada 30 min</option>
              </select>
          </div>
           <div className="relative flex items-center bg-card border rounded-md shadow-sm hover:border-primary/50 transition-colors">
             <select 
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="h-10 px-3 text-sm bg-transparent border-none focus:outline-none focus:ring-0 cursor-pointer text-muted-foreground font-medium appearance-none"
                title="Fuso Horário"
              >
                <option value="BRT">BRT (-3)</option>
                <option value="UTC">UTC (0)</option>
              </select>
          </div>
          
          <Input 
            type="date" 
            value={date} 
            onChange={(e) => setDate(e.target.value)}
            className="w-auto min-w-[140px] bg-card shadow-sm cursor-pointer"
          />
          <Button 
            variant="default" 
            size="icon" 
            onClick={() => fetchFireData(date, timezone)} 
            disabled={loading} 
            className="shadow-sm flex items-center justify-center p-0"
            title="Sincronizar/Buscar dados atualizados no satélite do CENSIPAM"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border-l-4 border-l-primary">
          <CardContent className="p-4 flex flex-col justify-center">
            <p className="text-sm text-muted-foreground font-medium truncate" title="Total no Estado">Focos Totais (Estado)</p>
            <p className="text-3xl font-bold text-foreground">{loading ? '...' : totalStateEvents}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-orange-500">
          <CardContent className="p-4 flex flex-col justify-center">
            <p className="text-sm text-muted-foreground font-medium truncate" title={locationLabel}>{locationLabel}</p>
            <p className="text-3xl font-bold text-foreground">{loading ? '...' : totalFocos}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-red-600">
          <CardContent className="p-4 flex flex-col justify-center">
            <p className="text-sm text-muted-foreground font-medium truncate" title="Área Estimada (ha)">Área Estimada (ha)</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-foreground">{loading ? '...' : areaTotal}</p>
              {!loading && <p className="text-xs text-muted-foreground font-medium">({areaTotalKm2} km²)</p>}
            </div>
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
            <WMSTileLayer
              url="https://panorama.sipam.gov.br/geoserver/painel_do_fogo/wms"
              layers="painel_do_fogo:focos_ativos"
              format="image/png"
              transparent={true}
              zIndex={10}
            />
              <WMSTileLayer
                url="https://panorama.sipam.gov.br/geoserver/painel_do_fogo/wms"
                layers="painel_do_fogo:mv_frente_deteccao"
                format="image/png"
                transparent={true}
                opacity={0.8}
              />

              {sortedEvents.map(event => (
                <Marker 
                  key={event.id} 
                  position={[event.lat, event.lng]}
                  icon={createPinIcon(selectedEvent === event.id, event.uc)}
                >
                  <Popup>
                    <div className="text-sm font-sans space-y-1">
                      <p className="font-bold text-base border-b pb-1 mb-1">{event.municipio}</p>
                      <p className="text-[11px] text-muted-foreground m-0 leading-tight"><span className="font-semibold">Lat:</span> {Number(event.lat).toFixed(6)}</p>
                      <p className="text-[11px] text-muted-foreground mb-1 leading-tight"><span className="font-semibold">Lon:</span> {Number(event.lng).toFixed(6)}</p>
                      <p><span className="font-semibold">Tamanho:</span> {event.tamanho_ha ? `${event.tamanho_ha} ha` : 'N/A'}</p>
                      <p><span className="font-semibold">Detecções:</span> {event.qtd_deteccoes}</p>
                      <p><span className="font-semibold">Duração:</span> {event.duracao_h ? `${event.duracao_h} h` : 'N/A'}</p>
                      {event.ucText && event.ucText !== 'N/A' && (
                         <p className="pt-1 mt-1 border-t border-muted/30 text-amber-600"><span className="font-bold">UC:</span> {event.ucText}</p>
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

              <MapController selectedEvent={selectedEvent} sortedEvents={sortedEvents} goiasCenter={goiasCenter} showUCs={showUCs} setShowUCs={setShowUCs} loadingUCs={loadingUCs} />
            </MapContainer>
          </CardContent>
        </Card>

        <Card className="flex flex-col h-[600px] shadow-lg">
          <CardHeader className="py-3 px-4 bg-muted/30 flex flex-row justify-between items-center">
            <CardTitle className="text-lg">Dados do Evento</CardTitle>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={exportToExcel} 
              className="flex flex-row items-center gap-2 h-8 px-3"
              title="Baixar os dados visíveis na tabela em formato Excel (.xlsx)"
            >
              <Download className="w-4 h-4" /> Exportar
            </Button>
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
                      <div className="flex items-center">Município <ArrowUpDown className="w-3 h-3 ml-1" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50 text-xs" onClick={() => requestSort('tamanho_ha')}>
                        Tamanho (ha) {sortConfig.key === 'tamanho_ha' && <ArrowUpDown className="inline w-3 h-3 ml-1" />}
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 text-xs" 
                      onClick={() => requestSort('qtd_deteccoes')}
                      title="Quantidade de registros/pixels de calor detectados por satélite neste foco. Valores altos indicam incêndios de maior gravidade, intensidade ou extensão."
                    >
                        Detecções {sortConfig.key === 'qtd_deteccoes' && <ArrowUpDown className="inline w-3 h-3 ml-1" />}
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50 text-xs" onClick={() => requestSort('duracao_h')}>
                      <div className="flex items-center">Duração <ArrowUpDown className="w-3 h-3 ml-1" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted text-xs" onClick={() => requestSort('uc')}>
                      <div className="flex items-center">Unid. de Conservação <ArrowUpDown className="w-3 h-3 ml-1" /></div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedEvents.length > 0 ? sortedEvents.map((event, index) => (
                    <TableRow 
                      key={event.id || index} 
                      className={`cursor-pointer transition-colors ${selectedEvent === event.id ? 'bg-primary/20' : 'hover:bg-muted/50'}`}
                      onClick={() => setSelectedEvent(selectedEvent === event.id ? null : event.id)}
                    >
                      <TableCell className="font-medium text-xs">{event.municipio || event.municipio_nome || 'N/A'}</TableCell>
                      <TableCell className="text-xs font-semibold">{event.tamanho_ha ? `${event.tamanho_ha} ha` : 'N/A'}</TableCell>
                      <TableCell className="text-xs text-orange-600 font-bold">{event.qtd_deteccoes || 0}</TableCell>
                      <TableCell className="text-xs">{event.duracao_h ? `${event.duracao_h} h` : 'N/A'}</TableCell>
                      <TableCell className="font-medium text-[10px] leading-tight py-2" title={event.ucText !== 'N/A' ? event.ucText : ''}>
                        {event.ucText !== 'N/A' ? <span className="text-amber-600 capitalize">{event.ucText.toLowerCase()}</span> : 'Não'}
                      </TableCell>
                    </TableRow>
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
          &copy; {new Date().getFullYear()} Painel Fogo Goiás. Todos os direitos reservados. | Versão 1.0.0
        </p>
      </footer>
    </div>
  );
}
