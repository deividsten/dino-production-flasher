
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Database, Cloud, Search, CheckCircle, AlertCircle, Loader2, TestTube } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { testFirebaseConnection } from '@/api/functions';
import { syncToFirebase } from '@/api/functions';
import { backupAllToFirebase } from '@/api/functions';
import { queryFirebase } from '@/api/functions';

export default function FirebaseBackup() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [fullError, setFullError] = useState(null);
  
  // Sync single record
  const [entityName, setEntityName] = useState('Dinosaur');
  const [recordId, setRecordId] = useState('');
  
  // Query
  const [queryEntity, setQueryEntity] = useState('Dinosaur');
  const [queryResults, setQueryResults] = useState(null);

  const handleTestConnection = async () => {
    setIsLoading(true);
    setDiagnostics(null);
    setResult(null);
    setFullError(null);
    
    try {
      console.log('🔵 Starting Firebase connection test...');
      
      // Add timeout of 30 seconds
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000)
      );
      
      const requestPromise = testFirebaseConnection({});
      
      const response = await Promise.race([requestPromise, timeoutPromise]);
      console.log('🔵 Response received:', response);
      
      const { data } = response;
      
      if (data.diagnostics) {
        setDiagnostics(data.diagnostics);
      }
      
      if (data.success) {
        setResult({ 
          type: 'success', 
          message: '✅ Conexión exitosa! Firebase está funcionando correctamente.' 
        });
      } else {
        setResult({ 
          type: 'error', 
          message: '❌ La conexión falló. Revisa los detalles abajo.' 
        });
      }
    } catch (error) {
      console.error('🔴 Error during test:', error);
      setFullError({
        message: error.message,
        response: error.response?.data,
        stack: error.stack
      });
      setResult({ 
        type: 'error', 
        message: `❌ Error: ${error.message}` 
      });
    }
    
    setIsLoading(false);
  };

  const handleSyncRecord = async () => {
    if (!entityName || !recordId) {
      alert('Please provide entity name and record ID');
      return;
    }

    setIsLoading(true);
    setResult(null);
    setFullError(null);
    
    try {
      const { data } = await syncToFirebase({ entity_name: entityName, record_id: recordId });
      setResult({ type: 'success', message: data.message, data });
    } catch (error) {
      console.error('Error syncing:', error);
      setFullError({
        message: error.message,
        response: error.response?.data,
        stack: error.stack
      });
      setResult({ type: 'error', message: error.message });
    }
    
    setIsLoading(false);
  };

  const handleFullBackup = async () => {
    if (!window.confirm('¿Hacer backup completo de todas las entidades a Firebase? Esto puede tomar varios minutos.')) {
      return;
    }

    setIsLoading(true);
    setResult(null);
    setFullError(null);
    
    try {
      const { data } = await backupAllToFirebase({});
      setResult({ 
        type: 'success', 
        message: `Backup completado: ${data.summary.total_records} registros`, 
        data 
      });
    } catch (error) {
      console.error('Error during backup:', error);
      setFullError({
        message: error.message,
        response: error.response?.data,
        stack: error.stack
      });
      setResult({ type: 'error', message: error.message });
    }
    
    setIsLoading(false);
  };

  const handleQuery = async () => {
    if (!queryEntity) {
      alert('Please provide entity name');
      return;
    }

    setIsLoading(true);
    setQueryResults(null);
    setFullError(null);
    
    try {
      const { data } = await queryFirebase({ 
        entity_name: queryEntity,
        limit: 50,
        order_by: '-created_date'
      });
      setQueryResults(data);
    } catch (error) {
      console.error('Error querying:', error);
      setFullError({
        message: error.message,
        response: error.response?.data,
        stack: error.stack
      });
      setQueryResults({ error: error.message });
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-orange-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Firebase Backup System</h1>
          <p className="text-slate-600">Sistema de respaldo y sincronización con Firebase Firestore</p>
          <p className="text-xs text-slate-500 mt-2">💡 Tip: Abre la consola del navegador (F12) para ver logs detallados</p>
        </div>

        {/* STEP 0: Test Connection */}
        <Card className="border-2 border-orange-200 bg-orange-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TestTube className="w-5 h-5 text-orange-600" />
              <CardTitle>0. Test de Conexión (EJECUTAR PRIMERO)</CardTitle>
            </div>
            <CardDescription>Verifica que las credenciales y la conexión a Firebase funcionen correctamente</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleTestConnection} 
              disabled={isLoading}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white"
              size="lg"
            >
              {isLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <TestTube className="w-5 h-5 mr-2" />}
              Probar Conexión a Firebase
            </Button>
          </CardContent>
        </Card>

        {/* Full Error Display */}
        <AnimatePresence>
          {fullError && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-4 rounded-lg border bg-red-50 border-red-200"
            >
              <div className="flex items-start gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-bold text-red-900">Error Completo:</h3>
                  <p className="text-red-800 text-sm mt-1">{fullError.message}</p>
                </div>
              </div>
              
              {fullError.response && (
                <div className="mt-3">
                  <h4 className="font-semibold text-red-900 text-sm mb-1">Response Data:</h4>
                  <pre className="text-xs bg-white/50 p-3 rounded overflow-x-auto text-red-900">
                    {JSON.stringify(fullError.response, null, 2)}
                  </pre>
                </div>
              )}
              
              {fullError.stack && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-red-900">Stack Trace</summary>
                  <pre className="text-xs bg-white/50 p-3 rounded overflow-x-auto mt-2 text-red-900">
                    {fullError.stack}
                  </pre>
                </details>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result Alert */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`p-4 rounded-lg border ${
                result.type === 'success' 
                  ? 'bg-green-50 border-green-200 text-green-800' 
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {result.type === 'success' ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
                <p className="font-medium">{result.message}</p>
              </div>
              {result.data?.results && (
                <div className="mt-3 space-y-1">
                  {result.data.results.map((r, i) => (
                    <div key={i} className="text-sm flex justify-between">
                      <span>{r.entity}</span>
                      <Badge variant={r.status === 'success' ? 'default' : 'destructive'}>
                        {r.records_count || 0} records
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Diagnostics Log */}
        <AnimatePresence>
          {diagnostics && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    Registro de Diagnóstico
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {diagnostics.steps.map((step, i) => (
                      <div 
                        key={i} 
                        className={`p-3 rounded-lg border ${
                          step.status === 'success' ? 'bg-green-50 border-green-200' :
                          step.status === 'error' ? 'bg-red-50 border-red-200' :
                          'bg-blue-50 border-blue-200'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {step.status === 'success' && <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />}
                          {step.status === 'error' && <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />}
                          {step.status === 'info' && <div className="w-4 h-4 rounded-full bg-blue-400 mt-0.5" />}
                          
                          <div className="flex-1">
                            <p className="font-medium text-sm">{step.step}</p>
                            {step.details && (
                              <pre className="mt-2 text-xs bg-white/50 p-2 rounded overflow-x-auto">
                                {JSON.stringify(step.details, null, 2)}
                              </pre>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Sync Single Record */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                <CardTitle>1. Sync Single Record</CardTitle>
              </div>
              <CardDescription>Sincroniza un registro específico a Firebase</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Entity Name</Label>
                <Input 
                  value={entityName} 
                  onChange={(e) => setEntityName(e.target.value)}
                  placeholder="Dinosaur, Component, etc."
                />
              </div>
              <div>
                <Label>Record ID</Label>
                <Input 
                  value={recordId} 
                  onChange={(e) => setRecordId(e.target.value)}
                  placeholder="Record ID to sync"
                />
              </div>
              <Button 
                onClick={handleSyncRecord} 
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Database className="w-4 h-4 mr-2" />}
                Sync to Firebase
              </Button>
            </CardContent>
          </Card>

          {/* Full Backup */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-green-600" />
                <CardTitle>2. Full Backup</CardTitle>
              </div>
              <CardDescription>Respalda toda la base de datos a Firebase</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-slate-600">
                  Esto sincronizará todas las entidades principales:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Components</li>
                    <li>Dinosaurs</li>
                    <li>Devices</li>
                    <li>Sales</li>
                    <li>Purchase Orders</li>
                    <li>Y más...</li>
                  </ul>
                </div>
                <Button 
                  onClick={handleFullBackup} 
                  disabled={isLoading}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Cloud className="w-4 h-4 mr-2" />}
                  Start Full Backup
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Query Firebase */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-purple-600" />
              <CardTitle>3. Query Firebase</CardTitle>
            </div>
            <CardDescription>Consulta datos desde Firebase Firestore</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Input 
                value={queryEntity} 
                onChange={(e) => setQueryEntity(e.target.value)}
                placeholder="Entity name"
                className="flex-1"
              />
              <Button 
                onClick={handleQuery} 
                disabled={isLoading}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>

            {queryResults && (
              <div className="border rounded-lg p-4 bg-slate-50 max-h-96 overflow-auto">
                {queryResults.error ? (
                  <p className="text-red-600">{queryResults.error}</p>
                ) : (
                  <>
                    <div className="mb-3 flex justify-between items-center">
                      <p className="font-medium">Results from Firebase</p>
                      <Badge>{queryResults.count} records</Badge>
                    </div>
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(queryResults.records, null, 2)}
                    </pre>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
