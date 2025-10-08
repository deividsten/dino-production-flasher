
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { User, Users, Shield, Edit, Trash2, Eye, EyeOff, Lock } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

const OperatorList = ({ operators, onEdit, onDelete }) => {
  const { t } = useLanguage();
  const [revealedCodes, setRevealedCodes] = useState(new Set());
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pendingOperatorId, setPendingOperatorId] = useState(null);
  const [pinError, setPinError] = useState('');

  // Get current operator from localStorage
  const getCurrentOperator = () => {
    try {
      const operatorData = localStorage.getItem('dinotrack-operator');
      if (operatorData) {
        return JSON.parse(operatorData);
      }
    } catch (error) {
      console.error("Error reading operator from localStorage:", error);
    }
    return null;
  };

  const handleToggleCode = (operatorId) => {
    if (revealedCodes.has(operatorId)) {
      // Hide code
      setRevealedCodes(prev => {
        const newSet = new Set(prev);
        newSet.delete(operatorId);
        return newSet;
      });
    } else {
      // Check if current user is admin
      const currentOperator = getCurrentOperator();
      if (currentOperator && currentOperator.is_admin) {
        // Admin can view directly
        setRevealedCodes(prev => new Set([...prev, operatorId]));
      } else {
        // Non-admin needs to enter admin PIN
        setPendingOperatorId(operatorId);
        setShowPinDialog(true);
        setPinInput('');
        setPinError('');
      }
    }
  };

  const handleVerifyPin = () => {
    // Find an admin operator with this PIN (converted to uppercase for alphanumeric matching)
    const adminOperator = operators.find(op => op.is_admin && op.code === pinInput.toUpperCase());
    
    if (adminOperator) {
      setRevealedCodes(prev => new Set([...prev, pendingOperatorId]));
      setShowPinDialog(false);
      setPinInput('');
      setPinError('');
      setPendingOperatorId(null);
    } else {
      setPinError(t('incorrect_admin_pin'));
      setPinInput('');
    }
  };

  const handlePinKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleVerifyPin();
    }
  };

  if (!operators || operators.length === 0) {
    return (
      <Card className="text-center p-12 bg-white/80">
        <Users className="mx-auto h-12 w-12 text-slate-400" />
        <h3 className="mt-4 text-lg font-medium text-slate-800">{t('no_operators_found')}</h3>
        <p className="mt-1 text-sm text-slate-500">{t('add_first_operator_prompt')}</p>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {operators.map((operator) => {
          const isCodeRevealed = revealedCodes.has(operator.id);
          
          return (
            <motion.div key={operator.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="bg-white/90 backdrop-blur-sm shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 ${operator.is_admin ? 'bg-gradient-to-r from-amber-100 to-yellow-100' : 'bg-gradient-to-r from-pink-100 to-purple-100'} rounded-full flex items-center justify-center`}>
                        {operator.is_admin ? (
                          <Shield className="w-6 h-6 text-amber-600" />
                        ) : (
                          <User className="w-6 h-6 text-pink-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-slate-800">{operator.name}</h3>
                          {operator.is_admin && (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
                              {t('admin')}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-sm text-slate-500">
                            {t('code')}: {isCodeRevealed ? (
                              <span className="font-mono text-slate-800 uppercase">{operator.code}</span>
                            ) : (
                              <span className="font-mono text-slate-400">••••</span>
                            )}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-slate-100"
                            onClick={() => handleToggleCode(operator.id)}
                          >
                            {isCodeRevealed ? (
                              <EyeOff className="h-3 w-3 text-slate-500" />
                            ) : (
                              <Eye className="h-3 w-3 text-slate-500" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-100" onClick={() => onEdit(operator)}>
                        <Edit className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-100" onClick={() => onDelete(operator.id)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                  
                  <p className="text-sm text-slate-600 mb-4">{operator.description}</p>
                  
                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-purple-600" />
                      {t('permissions')}
                    </h4>
                    {operator.permissions && operator.permissions.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {operator.permissions.slice(0, 5).map((permission) => (
                          <span key={permission} className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                            {t(permission)}
                          </span>
                        ))}
                        {operator.permissions.length > 5 && (
                          <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
                            +{operator.permissions.length - 5}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 italic">{t('no_permissions_assigned')}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* PIN Verification Dialog */}
      <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <Lock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <DialogTitle>{t('admin_verification')}</DialogTitle>
                <DialogDescription>{t('enter_admin_pin_to_view')}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="admin-pin">{t('admin_pin')}</Label>
              <Input
                id="admin-pin"
                type="text" // Changed to type="text" for alphanumeric input
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.toUpperCase())} // Converts input to uppercase
                onKeyDown={handlePinKeyDown}
                placeholder={t('code')} // Updated placeholder
                className="text-center text-2xl font-mono tracking-wider uppercase" // Added uppercase class
                autoFocus
              />
            </div>
            
            {pinError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{pinError}</p>
              </div>
            )}
            
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowPinDialog(false)} className="flex-1">
                {t('cancel')}
              </Button>
              <Button onClick={handleVerifyPin} disabled={pinInput.length === 0} className="flex-1 bg-amber-600 hover:bg-amber-700">
                {t('verify')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OperatorList;
