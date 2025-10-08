import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Operator } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LogIn, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

export default function OperatorLogin({ onLoginSuccess }) {
    const { t } = useLanguage();
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        if (code.length === 0) {
            setError('El código es requerido');
            return;
        }
        setIsLoading(true);
        setError('');

        try {
            const operators = await Operator.filter({ code: code });
            if (operators.length > 0) {
                const operator = operators[0];
                onLoginSuccess(operator);
            } else {
                setError('Código de operario inválido');
                setCode('');
            }
        } catch (err) {
            setError('Error al iniciar sesión');
            console.error(err);
        }
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-emerald-100 p-4">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                <Card className="w-full max-w-sm shadow-2xl">
                    <CardHeader className="text-center">
                        <div className="mx-auto w-16 h-16 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg mb-4">
                            <span className="text-4xl">🦕</span>
                        </div>
                        <CardTitle className="text-2xl font-bold">DinoTrack</CardTitle>
                        <CardDescription>Ingrese su código de operario</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-2">
                                <Input
                                    id="operator-code"
                                    type="password"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    placeholder="Código"
                                    className="text-center text-2xl font-mono tracking-wider h-12"
                                    autoFocus
                                />
                            </div>
                            
                            {error && (
                                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <AlertCircle className="w-4 h-4 text-red-600" />
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            )}
                            
                            <Button 
                                type="submit" 
                                className="w-full h-12 text-lg bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700" 
                                disabled={isLoading || code.length === 0}
                            >
                                {isLoading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Verificando...
                                    </div>
                                ) : (
                                    <>
                                        <LogIn className="w-5 h-5 mr-2" />
                                        Acceder
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}