import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SlackBotLog } from '@/api/entities';
import { useLanguage } from '@/components/LanguageProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, MessageSquare, Image, CheckCircle, AlertTriangle, RefreshCw, Filter, Code, Eye, EyeOff } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const logTypeConfig = {
  image_received: { 
    icon: Image, 
    label: 'Imagen Recibida', 
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    description: 'Usuario subió una imagen de orden de compra'
  },
  agent_response: { 
    icon: MessageSquare, 
    label: 'Respuesta del Agente', 
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    description: 'El agente respondió al usuario'
  },
  user_reply: { 
    icon: MessageSquare, 
    label: 'Respuesta del Usuario', 
    color: 'bg-green-100 text-green-800 border-green-200',
    description: 'Usuario respondió al agente'
  },
  po_created: { 
    icon: CheckCircle, 
    label: 'PO Creada', 
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    description: 'Orden de compra creada exitosamente'
  },
  error: { 
    icon: AlertTriangle, 
    label: 'Error', 
    color: 'bg-red-100 text-red-800 border-red-200',
    description: 'Ocurrió un error durante el proceso'
  }
};

export default function SlackBotLogs() {
  const { t } = useLanguage();
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true); // ✅ Auto-refresh ON por defecto
  const [filterType, setFilterType] = useState('all');
  const [expandedLogs, setExpandedLogs] = useState(new Set());
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isProcessing, setIsProcessing] = useState(false);

  const loadLogs = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const data = await SlackBotLog.list('-created_date', 100);
      setLogs(data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error loading Slack bot logs:', error);
    }
    if (showLoading) setIsLoading(false);
  };

  // Check for new messages and process them
  const checkAndProcessNewMessages = async () => {
    if (isProcessing) return; // Prevent concurrent processing
    
    setIsProcessing(true);
    try {
      const { readSlackHistory } = await import('@/api/functions');
      const response = await readSlackHistory({ 
        channel_name: 'inventory-tracking-bot' 
      });
      
      if (response.data.success && response.data.new_images_processed > 0) {
        console.log(`✅ ${response.data.new_images_processed} nuevas imágenes procesadas`);
        // Reload logs to show new entries
        await loadLogs(false);
      }
    } catch (error) {
      console.error('Error checking for new messages:', error);
    }
    setIsProcessing(false);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  // Auto-refresh: check for new messages every 5 seconds
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        checkAndProcessNewMessages();
      }, 5000); // 5 segundos
      return () => clearInterval(interval);
    }
  }, [autoRefresh, isProcessing]);

  const toggleExpand = (logId) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  const filteredLogs = filterType === 'all' 
    ? logs 
    : logs.filter(log => log.log_type === filterType);

  const logTypeCounts = logs.reduce((acc, log) => {
    acc[log.log_type] = (acc[log.log_type] || 0) + 1;
    return acc;
  }, {});

  if (isLoading && logs.length === 0) {
    return (
      <div className="flex justify-center items-center p-10">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50">
        <CardHeader>
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-indigo-600" />
                Slack Bot - Sistema Automático
                {autoRefresh && (
                  <Badge className="bg-green-500 text-white animate-pulse">
                    🔴 LIVE - Auto-procesando
                  </Badge>
                )}
              </CardTitle>
              <p className="text-sm text-slate-600 mt-2">
                Sistema de polling automático: detecta y procesa nuevas imágenes cada 5 segundos
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant={autoRefresh ? "default" : "outline"}
                size="sm" 
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={autoRefresh ? "bg-green-600 hover:bg-green-700" : ""}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${(autoRefresh || isProcessing) ? 'animate-spin' : ''}`} />
                {autoRefresh ? 'Auto-Proceso ON' : 'Auto-Proceso OFF'}
              </Button>
              <Button variant="outline" size="sm" onClick={checkAndProcessNewMessages} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Procesar Ahora
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-xs text-slate-600 mb-4">
            <span>Total de logs: <strong>{logs.length}</strong></span>
            <span>Última actualización: {lastRefresh.toLocaleTimeString('es-ES')}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            {Object.entries(logTypeConfig).map(([type, config]) => (
              <div key={type} className={`p-3 rounded-lg border-2 ${config.color}`}>
                <div className="flex items-center justify-between">
                  <config.icon className="w-4 h-4" />
                  <Badge variant="outline" className="text-xs">
                    {logTypeCounts[type] || 0}
                  </Badge>
                </div>
                <p className="text-xs font-medium mt-1">{config.label}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {Object.entries(logTypeConfig).map(([type, config]) => (
                  <SelectItem key={type} value={type}>
                    {config.label} ({logTypeCounts[type] || 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {filteredLogs.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <MessageSquare className="w-12 h-12 mx-auto text-slate-400 mb-3" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                {filterType === 'all' ? 'Sin Logs Aún' : 'No hay logs de este tipo'}
              </h3>
              <p className="text-sm text-slate-600">
                {filterType === 'all' 
                  ? 'Los logs aparecerán aquí cuando envíes imágenes al canal de Slack. El sistema las procesará automáticamente cada 5 segundos.'
                  : `No se encontraron logs de tipo "${logTypeConfig[filterType]?.label}"`
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredLogs.map((log, index) => {
            const config = logTypeConfig[log.log_type] || logTypeConfig.agent_response;
            const Icon = config.icon;
            const isExpanded = expandedLogs.has(log.id);
            
            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.5) }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${config.color} flex-shrink-0`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div>
                            <Badge className={`${config.color} mb-1`}>
                              {config.label}
                            </Badge>
                            <p className="text-xs text-slate-500">
                              {config.description}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="text-xs text-slate-600 block">
                              {new Date(log.created_date).toLocaleDateString('es-ES')}
                            </span>
                            <span className="text-xs font-mono text-slate-500">
                              {new Date(log.created_date).toLocaleTimeString('es-ES')}
                            </span>
                          </div>
                        </div>
                        
                        <p className="text-sm text-slate-700 mb-3 whitespace-pre-wrap leading-relaxed">
                          {log.message}
                        </p>
                        
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mb-2">
                          {log.slack_user_id && (
                            <span className="flex items-center gap-1">
                              👤 <code className="bg-slate-100 px-1 rounded">{log.slack_user_id}</code>
                            </span>
                          )}
                          {log.channel && (
                            <span className="flex items-center gap-1">
                              💬 <code className="bg-slate-100 px-1 rounded">#{log.channel}</code>
                            </span>
                          )}
                          {log.thread_ts && (
                            <span className="flex items-center gap-1">
                              🔗 Thread: <code className="bg-slate-100 px-1 rounded text-[10px]">{log.thread_ts}</code>
                            </span>
                          )}
                          {log.agent_conversation_id && (
                            <span className="flex items-center gap-1">
                              🤖 Conv: <code className="bg-slate-100 px-1 rounded text-[10px]">{log.agent_conversation_id.substring(0, 8)}...</code>
                            </span>
                          )}
                        </div>
                        
                        {log.file_url && (
                          <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                            <a 
                              href={log.file_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <Image className="w-3 h-3" />
                              Ver imagen de PO →
                            </a>
                          </div>
                        )}
                        
                        {log.po_data && (
                          <div className="mt-2 p-3 bg-emerald-50 rounded border border-emerald-200">
                            <p className="text-xs font-semibold text-emerald-900 mb-2 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              📦 Orden de Compra Creada
                            </p>
                            <div className="text-xs text-emerald-800 space-y-1">
                              {log.po_data.po_number && (
                                <p>• <strong>PO#:</strong> <code className="bg-emerald-100 px-1 rounded font-mono">{log.po_data.po_number}</code></p>
                              )}
                              {log.po_data.supplier_name && (
                                <p>• <strong>Proveedor:</strong> {log.po_data.supplier_name}</p>
                              )}
                              {log.po_data.items && (
                                <p>• <strong>Artículos:</strong> {log.po_data.items.length}</p>
                              )}
                              {log.po_data.id && (
                                <p>• <strong>ID:</strong> <code className="bg-emerald-100 px-1 rounded font-mono text-[10px]">{log.po_data.id}</code></p>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="mt-3 border-t border-slate-200 pt-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpand(log.id)}
                            className="text-xs h-7"
                          >
                            {isExpanded ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                            {isExpanded ? 'Ocultar' : 'Ver'} datos completos
                            <Code className="w-3 h-3 ml-1" />
                          </Button>

                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-2"
                            >
                              <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 text-xs overflow-x-auto">
                                {JSON.stringify(log, null, 2)}
                              </pre>
                            </motion.div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}