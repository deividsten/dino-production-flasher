import React, { useState, useEffect } from 'react';
import { SlackBotLog, SlackPOConversation, PurchaseOrder } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, AlertCircle, CheckCircle, MessageSquare, FileImage, Database } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SlackBotDiagnostics() {
  const [logs, setLogs] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [logsData, convsData, posData] = await Promise.all([
        SlackBotLog.list('-created_date', 50),
        SlackPOConversation.list('-created_date', 20),
        PurchaseOrder.list('-created_date', 10)
      ]);
      
      setLogs(logsData);
      setConversations(convsData);
      setPurchaseOrders(posData);
    } catch (error) {
      console.error('Error loading diagnostic data:', error);
    }
    setIsLoading(false);
  };

  const logTypeColors = {
    image_received: 'bg-blue-100 text-blue-800',
    agent_response: 'bg-purple-100 text-purple-800',
    user_reply: 'bg-green-100 text-green-800',
    po_created: 'bg-emerald-100 text-emerald-800',
    error: 'bg-red-100 text-red-800'
  };

  const logTypeIcons = {
    image_received: FileImage,
    agent_response: MessageSquare,
    user_reply: MessageSquare,
    po_created: Database,
    error: AlertCircle
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Slack Bot Diagnostics</h1>
            <p className="text-slate-600">Debug and monitor Slack bot activity</p>
          </div>
          <Button onClick={loadData} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Total Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-800">{logs.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Active Conversations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-800">
                {conversations.filter(c => c.status === 'pending_confirmation').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">POs Created</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-800">
                {logs.filter(l => l.log_type === 'po_created').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Conversations */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Conversations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {conversations.map(conv => {
                const relatedPO = purchaseOrders.find(po => po.id === conv.po_id);
                const relatedLogs = logs.filter(log => log.thread_ts === conv.thread_ts);
                
                return (
                  <motion.div
                    key={conv.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border rounded-lg p-4 bg-white"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-mono text-sm text-slate-600">Thread: {conv.thread_ts}</div>
                        <div className="text-xs text-slate-500">
                          User: {conv.slack_user_id} | Channel: {conv.channel}
                        </div>
                      </div>
                      <Badge className={
                        conv.status === 'completed' ? 'bg-green-100 text-green-800' :
                        conv.status === 'pending_confirmation' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }>
                        {conv.status}
                      </Badge>
                    </div>
                    
                    {relatedPO ? (
                      <div className="mt-2 p-2 bg-green-50 rounded border border-green-200">
                        <div className="flex items-center gap-2 text-green-800">
                          <CheckCircle className="w-4 h-4" />
                          <span className="font-medium">PO Created: {relatedPO.po_number}</span>
                        </div>
                        <div className="text-xs text-green-700 mt-1">
                          ID: {relatedPO.id} | Supplier: {relatedPO.supplier_name}
                        </div>
                      </div>
                    ) : conv.status === 'completed' && conv.po_id ? (
                      <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
                        <div className="flex items-center gap-2 text-red-800">
                          <AlertCircle className="w-4 h-4" />
                          <span className="font-medium">⚠️ PO ID exists but not found in database!</span>
                        </div>
                        <div className="text-xs text-red-700 mt-1 font-mono">
                          Claimed PO ID: {conv.po_id}
                        </div>
                      </div>
                    ) : null}
                    
                    <div className="mt-2 text-xs text-slate-500">
                      Logs: {relatedLogs.length} events
                    </div>
                  </motion.div>
                );
              })}
              
              {conversations.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  No conversations found
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {logs.map(log => {
                const Icon = logTypeIcons[log.log_type] || MessageSquare;
                
                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-l-4 border-slate-200 pl-4 py-2"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${logTypeColors[log.log_type] || 'bg-gray-100'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {log.log_type}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            {new Date(log.created_date).toLocaleString()}
                          </span>
                        </div>
                        
                        <div className="text-sm text-slate-700">{log.message}</div>
                        
                        {log.po_data && (
                          <details className="mt-2">
                            <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">
                              View PO Data
                            </summary>
                            <pre className="mt-2 p-2 bg-slate-50 rounded text-xs overflow-auto">
                              {JSON.stringify(log.po_data, null, 2)}
                            </pre>
                          </details>
                        )}
                        
                        <div className="text-xs text-slate-400 mt-1 font-mono">
                          Thread: {log.thread_ts}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              
              {logs.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  No logs found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}