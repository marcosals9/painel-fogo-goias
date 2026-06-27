import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { toPng } from 'html-to-image';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Flame, Download, X, Upload, Calendar, ThermometerSun, CheckCircle2, FileSpreadsheet, Trees, Truck, Sun } from 'lucide-react';

export default function InformativoMaker({ isOpen, onClose, fireEvents, date }) {
  const canvasRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  // Estados dos Dados SSP
  const [sspFile, setSspFile] = useState(null);
  const [totalAtendimentos, setTotalAtendimentos] = useState(0);
  const [sspMuni, setSspMuni] = useState([]);
  const [sspNat, setSspNat] = useState([]);

  // Estados dos Dias Secos (CIMEHGO)
  const [diasSeca, setDiasSeca] = useState({
    OESTE: 0,
    NORTE: 0,
    LESTE: 0,
    SUL: 0,
    CENTRAL: 0,
    SUDOESTE: 0
  });

  // Cálculo CENSIPAM (Focos de Calor)
  const censipamDados = useMemo(() => {
    const counts = {};
    let total = 0;
    (fireEvents || []).forEach(e => {
      total++;
      const mun = e.municipio || 'NÃO IDENTIFICADO';
      counts[mun] = (counts[mun] || 0) + 1;
    });
    const top = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 5);
    return { total, top };
  }, [fireEvents]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if(!file) return;
    setSspFile(file.name);
    
    const reader = new FileReader();
    reader.onload = (evt) => {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        let total = 0;
        const muniCounts = {};
        const natCounts = {};

        data.forEach(row => {
            total++;
            const mun = row['MUNICÍPIO'];
            if(mun) {
                muniCounts[mun] = (muniCounts[mun] || 0) + 1;
            }

            let natStr = row['NATUREZAS'] || '';
            let parsedNat = "OUTROS";
            
            const upperNat = natStr.toUpperCase();
            if(upperNat.includes('TERRENO BALDIO')) parsedNat = 'TERRENO BALDIO';
            else if(upperNat.includes('PROPRIEDADE RURAL')) parsedNat = 'PROPRIEDADE RURAL';
            else if(upperNat.includes('ÁREA VERDE')) parsedNat = 'ÁREA VERDE';
            else if(upperNat.includes('TERRAS DEVOLUTAS')) parsedNat = 'TERRAS DEVOLUTAS';
            else if(upperNat.includes('ESTRADA') || upperNat.includes('RODOVIA')) parsedNat = 'ESTRADA/RODOVIA';
            else if(natStr) {
                const parts = natStr.split('->');
                const lastPart = parts[parts.length - 1].trim();
                parsedNat = lastPart.replace(/\(\d+\)/g, '').trim().toUpperCase();
            }

            natCounts[parsedNat] = (natCounts[parsedNat] || 0) + 1;
        });

        setSspMuni(Object.entries(muniCounts).sort((a,b)=>b[1]-a[1]).slice(0,5));
        setSspNat(Object.entries(natCounts).sort((a,b)=>b[1]-a[1]).slice(0,5));
        setTotalAtendimentos(total);
    };
    reader.readAsBinaryString(file);
  };

  const downloadImage = async () => {
    if (!canvasRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(canvasRef.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `Informativo_Estiagem_${date}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Erro ao gerar imagem:', err);
      alert('Erro ao gerar a imagem. Tente novamente.');
    } finally {
      setDownloading(false);
    }
  };

  if (!isOpen) return null;

  const displayDate = date.split('-').reverse().join('/');

  // Helpers de Renderização das Barras
  const renderBar = (label, value, max, colorClass, widthClass = 'w-full') => (
    <div key={label} className="flex flex-col mb-1 text-sm font-bold">
      <div className="flex items-center">
        <div className="w-[120px] text-right pr-2 text-[#002b5e] leading-none text-[11px] truncate">{label}</div>
        <div className={`flex-1 flex items-center bg-gray-100 h-6 ${widthClass}`}>
          <div className={`${colorClass} h-full flex items-center justify-end pr-2 text-black/80 font-extrabold`} style={{ width: max > 0 ? `${(value/max)*100}%` : '0%', minWidth: '24px' }}>
             {value}
          </div>
        </div>
      </div>
    </div>
  );

  const maxSspMuni = Math.max(...sspMuni.map(d => d[1]), 1);
  const maxCenMuni = Math.max(...censipamDados.top.map(d => d[1]), 1);
  const maxSspNat = Math.max(...sspNat.map(d => d[1]), 1);
  const maxDias = Math.max(...Object.values(diasSeca), 14);

  return (
    <div className="fixed inset-0 z-[999] bg-background/95 backdrop-blur-sm flex overflow-hidden">
      
      {/* Controles (Esquerda) */}
      <div className="w-[400px] bg-card border-r shadow-xl flex flex-col h-full">
        <div className="p-4 border-b flex justify-between items-center bg-muted/30">
          <div>
            <h2 className="text-lg font-bold">Gerador de Informativo</h2>
            <p className="text-xs text-muted-foreground">Preencha os dados manuais</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5"/></Button>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto space-y-6">
          
          <div className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Upload className="w-4 h-4"/> 1. Ocorrências (SSP)</h3>
            <div className="border-2 border-dashed rounded-lg p-4 text-center hover:bg-muted/50 transition-colors">
              <Input type="file" accept=".xls,.xlsx,.csv" id="ssp-file" className="hidden" onChange={handleFileUpload} />
              <Label htmlFor="ssp-file" className="cursor-pointer flex flex-col items-center gap-2">
                {sspFile ? <CheckCircle2 className="w-8 h-8 text-green-500" /> : <FileSpreadsheet className="w-8 h-8 text-muted-foreground" />}
                <span className="text-sm font-medium">{sspFile ? sspFile : 'Clique para anexar arquivo SSP (.xls)'}</span>
              </Label>
            </div>
            {totalAtendimentos > 0 && <p className="text-xs text-green-600 font-medium">Lidos: {totalAtendimentos} atendimentos</p>}
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Flame className="w-4 h-4"/> 2. Focos de Calor (CENSIPAM)</h3>
            <p className="text-xs text-muted-foreground bg-muted p-2 rounded border">Dados coletados automaticamente do mapa (Total: {censipamDados.total} focos na data {displayDate}). Nenhuma ação necessária.</p>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2"><ThermometerSun className="w-4 h-4"/> 3. Seca CIMEHGO (Dias)</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.keys(diasSeca).map(regiao => (
                <div key={regiao} className="space-y-1">
                  <Label className="text-xs">{regiao}</Label>
                  <Input 
                    type="number" min="0" value={diasSeca[regiao]} 
                    onChange={(e) => setDiasSeca({...diasSeca, [regiao]: Number(e.target.value)})} 
                    className="h-8"
                  />
                </div>
              ))}
            </div>
          </div>
          
        </div>

        <div className="p-4 border-t bg-muted/30">
          <Button className="w-full font-bold h-12 text-md" onClick={downloadImage} disabled={downloading}>
            {downloading ? 'Gerando Imagem...' : 'Baixar Imagem para WhatsApp'} <Download className="w-5 h-5 ml-2"/>
          </Button>
        </div>
      </div>

      {/* Preview (Direita) */}
      <div className="flex-1 bg-black/5 overflow-y-auto flex justify-center py-8">
        
        {/* Container do Canvas A4/Poster - Aspect Ratio aproximado 800x1130 */}
        <div 
            ref={canvasRef} 
            className="bg-white shadow-2xl shrink-0 relative flex flex-col font-sans overflow-hidden"
            style={{ width: '800px', height: '1130px', transformOrigin: 'top center', transform: 'scale(0.85)' }}
        >
            {/* Camada do Template do Canva (Enviado pelo usuário) */}
            <img src="/template.png" className="absolute inset-0 w-full h-full z-0 pointer-events-none object-cover" alt="Template Canva" onError={(e) => e.target.style.display = 'none'} />

            {/* Header - Agora Vazio, o template já tem as logos e textos */}
            <div className="bg-transparent h-[180px] p-6 relative z-10">
            </div>

            {/* Fita Laranja Data */}
            <div className="mx-4 mt-[-10px] z-20">
                <div className="bg-transparent rounded-2xl flex items-center h-[70px]">
                    <div className="w-[100px] h-[70px] shrink-0"></div>
                    <div className="flex-1 py-2 flex flex-col justify-center pl-6">
                        <h3 className="text-xl font-black text-[#002b5e] leading-tight">DADOS DO DIA {displayDate}</h3>
                    </div>
                </div>
            </div>

            {/* Grid 2x2 Quadrantes */}
            <div className="grid grid-cols-2 gap-4 p-4 flex-1 mt-2">
                
                {/* Q1: Atendimentos SSP */}
                <div className="bg-transparent rounded-xl flex flex-col overflow-hidden z-10 relative">
                    <div className="text-white flex items-center p-2 h-[100px] absolute top-1 left-28">
                        <div className="flex gap-3 items-center w-full pl-2">
                            <span className="text-[60px] font-black leading-none drop-shadow-md text-white">{totalAtendimentos.toString().padStart(2, '0')}</span>
                        </div>
                    </div>
                    <div className="p-3 flex-1 flex flex-col justify-end pb-12 pt-[130px]">
                        {sspMuni.map(([mun, val]) => renderBar(mun, val, maxSspMuni, 'bg-[#76e5d7]'))}
                        {sspMuni.length === 0 && <div className="text-center text-gray-400 font-bold mt-10">Anexe a planilha SSP</div>}
                    </div>
                </div>

                {/* Q2: Focos CENSIPAM */}
                <div className="bg-transparent rounded-xl flex flex-col overflow-hidden z-10 relative">
                    <div className="text-white flex items-center p-2 h-[100px] absolute top-1 left-28">
                        <div className="flex gap-3 items-center w-full pl-2">
                            <span className="text-[60px] font-black leading-none drop-shadow-md text-white">{censipamDados.total.toString().padStart(2, '0')}</span>
                        </div>
                    </div>
                    <div className="p-3 flex-1 flex flex-col justify-end pb-12 pt-[130px]">
                        {censipamDados.top.map(([mun, val]) => renderBar(mun, val, maxCenMuni, 'bg-[#76e5d7]', 'w-[90%]'))}
                        {censipamDados.top.length === 0 && <div className="text-center text-gray-400 font-bold mt-10">Sem focos na data</div>}
                    </div>
                </div>

                {/* Q3: Naturezas */}
                <div className="bg-transparent rounded-xl flex flex-col overflow-hidden z-10 relative">
                    <div className="p-3 flex-1 flex flex-col justify-end pb-14 pt-[130px]">
                        {sspNat.map(([nat, val]) => renderBar(nat, val, maxSspNat, 'bg-[#f47f20]'))}
                        {sspNat.length === 0 && <div className="text-center text-gray-400 font-bold mt-10">Anexe a planilha SSP</div>}
                    </div>
                </div>

                {/* Q4: CIMEHGO */}
                <div className="bg-transparent rounded-xl flex flex-col overflow-hidden z-10 relative">
                    <div className="p-3 flex-1 flex flex-col justify-end pb-14 pt-[130px]">
                        {['OESTE','NORTE','LESTE','SUL','CENTRAL','SUDOESTE'].map(reg => renderBar(reg, diasSeca[reg] || 0, maxDias, 'bg-[#3bbbf6]'))}
                    </div>
                </div>

            </div>

            {/* Footer do Template Original vai sobrepor o rodapé */}
            <div className="mt-2 h-[120px] bg-transparent">
                {/* O espaço em branco é preenchido pela imagem do template (z-50) */}
            </div>

        </div>

      </div>
    </div>
  );
}
