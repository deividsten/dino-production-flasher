import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ComponentsGuide() {
  const componentsData = [
    {
      name: "DINO-1.6.2-Front Housing",
      description: "Carcasa frontal para dinosaurio versión 1.6.2", 
      tracking_type: "lote",
      supplier: "Fabricante Principal"
    },
    {
      name: "DINO-1.6.2-Rear Housing",
      description: "Carcasa trasera para dinosaurio versión 1.6.2",
      tracking_type: "lote", 
      supplier: "Fabricante Principal"
    },
    {
      name: "DINO-V2-DATA-CABLE",
      description: "Cable de datos para dinosaurio versión 2",
      tracking_type: "lote",
      supplier: "Proveedor Cables"
    },
    {
      name: "DINO-V2-BATTERY", 
      description: "Batería para dinosaurio versión 2",
      tracking_type: "unidad",
      supplier: "Proveedor Baterías"
    },
    {
      name: "OTS-MECH-SCREW-PAN-HEAD-M3X6MM",
      description: "Tornillo mecánico cabeza plana M3x6mm",
      tracking_type: "lote",
      supplier: "Proveedor Tornillería"
    },
    {
      name: "OTS-MECH-SCREW-PAN-HEAD-M3X12MM", 
      description: "Tornillo mecánico cabeza plana M3x12mm",
      tracking_type: "lote",
      supplier: "Proveedor Tornillería"
    },
    {
      name: "3M VHB Tape 5952",
      description: "Cinta adhesiva 3M VHB modelo 5952", 
      tracking_type: "lote",
      supplier: "3M"
    },
    {
      name: "OTS-MECH-GROMET",
      description: "Ojal mecánico/grommet",
      tracking_type: "lote", 
      supplier: "Proveedor Componentes"
    },
    {
      name: "Foam Bottom",
      description: "Base de espuma amortiguadora",
      tracking_type: "lote",
      supplier: "Proveedor Espumas"
    },
    {
      name: "DINO-1.6.2-MECH-SPEAKER",
      description: "Altavoz mecánico para dinosaurio versión 1.6.2",
      tracking_type: "unidad",
      supplier: "Proveedor Audio"
    },
    {
      name: "DINO-1.6.2-MIC-RINGS", 
      description: "Anillos de micrófono para dinosaurio versión 1.6.2",
      tracking_type: "lote",
      supplier: "Proveedor Audio" 
    },
    {
      name: "DINO-1.6.2-MECH-BASE",
      description: "Base mecánica para dinosaurio versión 1.6.2",
      tracking_type: "lote",
      supplier: "Fabricante Principal"
    },
    {
      name: "DINO-V2-PCBA-SWITCH",
      description: "Interruptor PCBA para dinosaurio versión 2", 
      tracking_type: "unidad",
      supplier: "Proveedor Electrónicos"
    },
    {
      name: "CABLE CLIPS",
      description: "Clips para sujeción de cables",
      tracking_type: "lote",
      supplier: "Proveedor Componentes"
    }
  ];

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Componentes para Crear Manualmente</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Ve a Dashboard → Data → Components y crea cada uno de estos componentes:
          </p>
          <div className="space-y-3">
            {componentsData.map((comp, idx) => (
              <div key={idx} className="border rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-start">
                  <h4 className="font-medium">{comp.name}</h4>
                  <Badge variant={comp.tracking_type === 'unidad' ? 'default' : 'secondary'}>
                    {comp.tracking_type}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">{comp.description}</p>
                <p className="text-xs text-blue-600">Proveedor: {comp.supplier}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}