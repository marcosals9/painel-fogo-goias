import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Send, QrCode, CheckCircle2, AlertTriangle, RefreshCw, LogOut } from 'lucide-react';
import { toPng } from 'html-to-image';
import { supabase } from '@/lib/supabase';

export default function WhatsAppSender({ canvasRef, date }) {
  const [status, setStatus] = useState('DISCONNECTED');
  const [qrCode, setQrCode] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  
  const [customDestinatario, setCustomDestinatario] = useState('');
  
  const [selectedDestinos, setSelectedDestinos] = useState(() => {
    const saved = localStorage.getItem('codec_default_destinos');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [texto, setTexto] = useState(`⚠️ INFORMATIVO DEFESA CIVIL - ${date}\n\nSegue a atualização diária dos dados de estiagem e focos de calor no Estado de Goiás.\n\n#DefesaCivil #CBMGO #GovernoDeGoias`);
  
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  const [chats, setChats] = useState([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchChats = async () => {
    setLoadingChats(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || localStorage.getItem('codec_token');
      const res = await axios.get(`${import.meta.env.PROD ? '' : 'http://localhost:3001'}/api/whatsapp/chats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setChats(res.data.chats);
      }
    } catch (err) {
      console.error('Erro ao buscar chats:', err);
    } finally {
      setLoadingChats(false);
    }
  };

  const fetchStatus = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || localStorage.getItem('codec_token');
      const res = await axios.get(`${import.meta.env.PROD ? '' : 'http://localhost:3001'}/api/whatsapp/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus(res.data.status);
      setQrCode(res.data.qrCode);
    } catch (err) {
      console.error('Erro ao buscar status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (status === 'CONNECTED' && chats.length === 0) {
      fetchChats();
    }
  }, [status]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSend = async () => {
    const finalTargets = [...selectedDestinos];
    if (customDestinatario.trim() !== '') {
        finalTargets.push(customDestinatario.trim());
    }

    if (finalTargets.length === 0) {
      alert('Selecione pelo menos um destinatário ou digite um número.');
      return;
    }

    setSending(true);
    setSendResult(null);
    try {
      let imageBase64 = null;
      if (canvasRef && canvasRef.current) {
        imageBase64 = await toPng(canvasRef.current, { cacheBust: true, pixelRatio: 2 });
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || localStorage.getItem('codec_token');
      const payload = {
        titulo: `Boletim ${date}`,
        texto,
        destinatarios: finalTargets,
        imagemBase64: imageBase64
      };

      const res = await axios.post(`${import.meta.env.PROD ? '' : 'http://localhost:3001'}/api/whatsapp/send`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        setSendResult({ type: 'success', msg: res.data.message });
      } else {
        setSendResult({ type: 'error', msg: res.data.error || 'Erro desconhecido' });
      }
    } catch (err) {
      console.error(err);
      setSendResult({ type: 'error', msg: err.response?.data?.error || 'Falha na comunicação com o servidor' });
    } finally {
      setSending(false);
    }
  };

  const handleLogoutWhatsApp = async () => {
    if (!window.confirm("Deseja realmente desconectar o robô do WhatsApp? Você precisará ler o QR Code novamente.")) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || localStorage.getItem('codec_token');
      await axios.post(`${import.meta.env.PROD ? '' : 'http://localhost:3001'}/api/whatsapp/logout`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus('DISCONNECTED');
      setQrCode(null);
    } catch (err) {
      console.error('Erro ao deslogar:', err);
    }
  };

  const filteredChats = chats.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-4 border rounded-xl p-4 bg-white shadow-sm mt-4">
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="font-bold flex items-center gap-2 text-sm"><Send className="w-4 h-4 text-green-600"/> Envio via WhatsApp</h3>
        
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase">
          {loadingStatus ? <Loader2 className="w-3 h-3 animate-spin"/> : (
            <>
              {status === 'CONNECTED' && (
                <>
                  <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Conectado</span>
                  <button onClick={handleLogoutWhatsApp} className="ml-2 text-red-500 hover:text-red-700 p-1" title="Desconectar WhatsApp">
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              {status === 'QR_READY' && <span className="text-yellow-600 flex items-center gap-1"><QrCode className="w-3 h-3"/> Aguardando QR Code</span>}
              {status === 'DISCONNECTED' && <span className="text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Desconectado</span>}
            </>
          )}
        </div>
      </div>

      {status === 'QR_READY' && qrCode && (
        <div className="flex flex-col items-center justify-center p-4 bg-muted/30 rounded-lg border">
          <p className="text-xs font-semibold mb-2">Escaneie com o celular da Corporação</p>
          <img src={qrCode} alt="QR Code WhatsApp" className="w-32 h-32 border bg-white p-2 rounded-lg shadow-sm" />
        </div>
      )}

      {status === 'CONNECTED' && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Contatos e Grupos</Label>
            <Input 
              placeholder="Buscar contato..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 text-xs mb-1 bg-white"
            />
            <div className="max-h-40 overflow-y-auto border rounded-md p-2 text-xs space-y-1 bg-muted/20">
              {loadingChats ? (
                <div className="text-muted-foreground p-2">Carregando contatos...</div>
              ) : (
                filteredChats.map(c => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted p-1.5 rounded transition-colors">
                    <input 
                      type="checkbox" 
                      className="accent-green-600 w-4 h-4"
                      checked={selectedDestinos.includes(c.id)}
                      onChange={(e) => {
                        const next = e.target.checked 
                          ? [...selectedDestinos, c.id]
                          : selectedDestinos.filter(id => id !== c.id);
                        setSelectedDestinos(next);
                        localStorage.setItem('codec_default_destinos', JSON.stringify(next));
                      }}
                    />
                    <span className="truncate">{c.isGroup ? '👥' : '👤'} {c.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Ou digite outro número (com DDD)</Label>
            <Input 
              placeholder="Ex: 62999999999" 
              value={customDestinatario} 
              onChange={(e) => setCustomDestinatario(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Mensagem (Texto que acompanha a imagem)</Label>
            <textarea 
              className="w-full h-24 p-2 text-xs border rounded-md focus:ring-1 focus:ring-green-500 outline-none"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          </div>

          <Button 
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-10 flex items-center justify-center gap-2" 
            onClick={handleSend} 
            disabled={sending || (selectedDestinos.length === 0 && !customDestinatario)}
          >
            {sending ? (
              <><Loader2 className="w-4 h-4 animate-spin"/> <span>Enviando...</span></>
            ) : (
              <><Send className="w-4 h-4"/> <span>Enviar Boletim</span></>
            )}
          </Button>

          {sendResult && (
            <div className={`p-3 rounded-md text-xs font-semibold mt-2 ${sendResult.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {sendResult.msg}
            </div>
          )}
        </div>
      )}
      
      {status === 'DISCONNECTED' && (
        <div className="text-center p-4">
          <p className="text-xs text-muted-foreground mb-2">O robô do WhatsApp está desconectado.</p>
          <Button variant="outline" size="sm" className="flex items-center justify-center gap-1.5" onClick={fetchStatus}>
            <RefreshCw className="w-3 h-3" /> Tentar Novamente
          </Button>
        </div>
      )}
    </div>
  );
}
