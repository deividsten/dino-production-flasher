import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/components/LanguageProvider";
import { Shipment } from "@/api/entities";

export default function CountdownToChristmas() {
  const { t } = useLanguage();
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  const [dinosIn3PL, setDinosIn3PL] = useState(0);
  const [isLoadingDinos, setIsLoadingDinos] = useState(true);

  const GOAL_3PL = 10000;

  useEffect(() => {
    loadDinosIn3PL();
  }, []);

  const loadDinosIn3PL = async () => {
    setIsLoadingDinos(true);
    try {
      const shipments = await Shipment.list();
      const uniqueRfids = new Set();
      shipments.forEach(shipment => {
        if (shipment.dinosaur_rfids && Array.isArray(shipment.dinosaur_rfids)) {
          shipment.dinosaur_rfids.forEach(rfid => uniqueRfids.add(rfid));
        }
      });
      setDinosIn3PL(uniqueRfids.size);
    } catch (error) {
      console.error("Error loading dinos in 3PL:", error);
      setDinosIn3PL(0);
    }
    setIsLoadingDinos(false);
  };

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      let targetDate = new Date(currentYear, 11, 15);
      
      if (now > targetDate) {
        targetDate = new Date(currentYear + 1, 11, 15);
      }
      
      const difference = targetDate - now;
      
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, []);

  const progressPercentage = Math.min((dinosIn3PL / GOAL_3PL) * 100, 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8 flex items-center justify-center">
      <div className="max-w-6xl w-full">
        {/* Goal Text - Horizontal at top */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-bold text-slate-800 mb-2">
            10,000 Bonds in Warehouse by Dec 15
          </h1>
        </motion.div>

        {/* Countdown Timer */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-20"
        >
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="text-[12rem] font-bold text-slate-800 leading-none tracking-tight">
              {String(timeLeft.days).padStart(2, '0')}
            </div>
            <div className="text-[12rem] font-bold text-slate-800 leading-none">:</div>
            <div className="text-[12rem] font-bold text-slate-800 leading-none tracking-tight">
              {String(timeLeft.hours).padStart(2, '0')}
            </div>
            <div className="text-[12rem] font-bold text-slate-800 leading-none">:</div>
            <div className="text-[12rem] font-bold text-slate-800 leading-none tracking-tight">
              {String(timeLeft.minutes).padStart(2, '0')}
            </div>
            <div className="text-[12rem] font-bold text-slate-800 leading-none">:</div>
            <div className="text-[12rem] font-bold text-slate-800 leading-none tracking-tight">
              {String(timeLeft.seconds).padStart(2, '0')}
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-4 text-2xl font-medium text-slate-500 tracking-widest uppercase">
            <span>DD</span>
            <span>:</span>
            <span>HH</span>
            <span>:</span>
            <span>MM</span>
            <span>:</span>
            <span>SS</span>
          </div>
        </motion.div>

        {/* Progress Display */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center"
        >
          <div className="flex items-center justify-center gap-8 mb-8">
            <div className="text-[10rem] font-bold text-emerald-600 leading-none">
              {isLoadingDinos ? "..." : dinosIn3PL.toLocaleString()}
            </div>
            <div className="text-[10rem] font-bold text-slate-300 leading-none">/</div>
            <div className="text-[10rem] font-bold text-slate-400 leading-none">
              {GOAL_3PL.toLocaleString()}
            </div>
          </div>

          {/* Simple progress bar */}
          <div className="w-full max-w-3xl mx-auto">
            <div className="h-6 bg-slate-200 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600"
              />
            </div>
            
            <div className="mt-4 text-2xl font-semibold text-slate-600">
              {progressPercentage.toFixed(1)}% Complete
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}