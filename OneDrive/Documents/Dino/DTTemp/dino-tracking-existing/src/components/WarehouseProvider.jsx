import React, { createContext, useState, useContext, useEffect } from 'react';
import { Warehouse } from '@/api/entities';

const WarehouseContext = createContext();

// ID especial para el warehouse BASE
export const BASE_WAREHOUSE_ID = 'BASE';

export const WarehouseProvider = ({ children }) => {
  const [warehouses, setWarehouses] = useState([]);
  const [activeWarehouse, setActiveWarehouse] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadWarehouses();
  }, []);

  const loadWarehouses = async () => {
    try {
      let data = await Warehouse.list('-created_date');
      
      // Verificar si existe el warehouse BASE
      let baseWarehouse = data.find(w => w.code === 'BASE');
      
      // Si no existe, crearlo
      if (!baseWarehouse) {
        console.log('📦 Creating BASE warehouse...');
        baseWarehouse = await Warehouse.create({
          name: 'Base de Datos Original',
          code: 'BASE',
          description: 'Warehouse por defecto que contiene todos los datos históricos y sin asignar',
          location: 'Sistema',
          is_active: true
        });
        // Recargar la lista
        data = await Warehouse.list('-created_date');
      }
      
      setWarehouses(data);
      
      // Check if there's a saved warehouse in localStorage
      const savedWarehouseId = localStorage.getItem('dinotrack-active-warehouse');
      
      if (savedWarehouseId && data.find(w => w.id === savedWarehouseId)) {
        const saved = data.find(w => w.id === savedWarehouseId);
        setActiveWarehouse(saved);
      } else {
        // Set BASE warehouse as default
        const base = data.find(w => w.code === 'BASE');
        if (base) {
          setActiveWarehouse(base);
          localStorage.setItem('dinotrack-active-warehouse', base.id);
        }
      }
    } catch (error) {
      console.error('Error loading warehouses:', error);
    }
    setIsLoading(false);
  };

  const switchWarehouse = (warehouse) => {
    setActiveWarehouse(warehouse);
    localStorage.setItem('dinotrack-active-warehouse', warehouse.id);
    // Reload the page to refresh all data
    window.location.reload();
  };

  const createWarehouse = async (data) => {
    const newWarehouse = await Warehouse.create(data);
    await loadWarehouses();
    return newWarehouse;
  };

  const updateWarehouse = async (id, data) => {
    await Warehouse.update(id, data);
    await loadWarehouses();
  };

  const deleteWarehouse = async (id) => {
    // No permitir eliminar el warehouse BASE
    const warehouse = warehouses.find(w => w.id === id);
    if (warehouse && warehouse.code === 'BASE') {
      throw new Error('No se puede eliminar el warehouse BASE');
    }
    await Warehouse.delete(id);
    await loadWarehouses();
  };

  // Helper function para filtrar por warehouse
  // Si es BASE, incluir records sin warehouse_id O con warehouse_id = activeWarehouse.id
  const filterByWarehouse = (records) => {
    if (!activeWarehouse) return records;
    
    const isBase = activeWarehouse.code === 'BASE';
    
    return records.filter(record => {
      if (isBase) {
        // En BASE: mostrar records sin warehouse_id o con warehouse_id = BASE
        return !record.warehouse_id || record.warehouse_id === activeWarehouse.id;
      } else {
        // En otros warehouses: solo mostrar records con ese warehouse_id
        return record.warehouse_id === activeWarehouse.id;
      }
    });
  };

  return (
    <WarehouseContext.Provider
      value={{
        warehouses,
        activeWarehouse,
        isLoading,
        switchWarehouse,
        createWarehouse,
        updateWarehouse,
        deleteWarehouse,
        loadWarehouses,
        filterByWarehouse
      }}
    >
      {children}
    </WarehouseContext.Provider>
  );
};

export const useWarehouse = () => {
  const context = useContext(WarehouseContext);
  if (!context) {
    throw new Error('useWarehouse must be used within a WarehouseProvider');
  }
  return context;
};