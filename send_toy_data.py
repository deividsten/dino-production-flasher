#!/usr/bin/env python3
"""
Script para enviar datos de juguete a la API
"""

from api_client import update_toy_inventory

def send_toy_data():
    """Enviar datos específicos del juguete a la API"""

    # Datos del juguete que mencionaste
    toy_id = "toy_4paqpj"        # El nuevo toy ID que me diste
    mac_address = "8cbfea84b8c8"  # El MAC address que me diste

    # Datos de prueba (puedes modificar esto)
    test_data = {
        "logs": "Manual entry - device programmed successfully",
        "status": "completed",
        "timestamp": "2025-10-24T17:42:00Z",
        "qc_results": {
            "passed": True,
            "tests": [
                {
                    "name": "Microphone Balance Test",
                    "status": "pass",
                    "rms_L": 0.85,
                    "rms_R": 0.82,
                    "balance": "good"
                }
            ]
        }
    }

    print("🚀 Enviando datos del juguete a la API...")
    print(f"   Toy ID: {toy_id}")
    print(f"   MAC Address: {mac_address}")
    print(f"   Test Data: {test_data}")

    # Enviar a la API
    success = update_toy_inventory(toy_id, mac_address, test_data)

    if success:
        print("✅ Datos enviados exitosamente a la API!")
        print("📡 El juguete ha sido registrado en el inventario.")
    else:
        print("❌ Error al enviar datos a la API.")
        print("🔍 Revisa la conexión y configuración de la API.")

    return success

if __name__ == "__main__":
    send_toy_data()
