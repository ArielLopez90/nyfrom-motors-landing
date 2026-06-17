# Nyfrom Motors App

MVP en Next.js para probar login real, registro de vehiculos e historial de servicios.

## Que incluye

- Crear cuenta e iniciar sesion con Supabase.
- Registrar perfil del usuario:
  - Nombre
  - Apellido
  - Genero
  - Fecha de nacimiento
  - Km recorridos por dia o por mes
- Registrar vehiculo:
  - Placa
  - VIN
  - Marca
  - Linea
  - Modelo
  - Motor
  - Uso
  - Tipo
  - Asientos
  - Color
  - Cilindros
  - CC
- Registrar historial:
  - Servicio de Motor
  - Servicio de Caja
  - Servicio de Frenos
  - Servicio de Suspension
  - Servicio de Direccion
  - Servicio Electrico
  - Servicio de Aire Acondicionado
  - Servicio de Llantas
  - Alineacion y Balanceo
  - Cambio de Aceite
  - Diagnostico General
  - Escaneo Computarizado
  - Revision Pre-compra
  - Mantenimiento General
  - Fecha
  - Kilometraje opcional
  - Proximo servicio recomendado en km
  - Monto estimado por reparacion o mantenimiento
  - Notas opcionales
- Calcular proximos servicios tomando como base el recorrido del usuario.
- Mostrar resumen del perfil y accesos rapidos a cada seccion.
- Mostrar costo estimado de proximos 30 dias.
- Mostrar gasto anual registrado del vehiculo.
- Filtrar historial por vehiculo.
- Editar o borrar vehiculos y servicios.

Las fechas estimadas se calculan con:

```text
km recomendados para el proximo servicio / km recorridos por dia
```

Si tambien agregas kilometraje actual al servicio, la app muestra el proximo kilometraje recomendado.

## Configurar Supabase

1. Crea un proyecto en Supabase.
2. En Supabase, abre SQL Editor.
3. Ejecuta el archivo `database/schema.sql`.
4. Copia `.env.example` como `.env.local`.
5. Completa `.env.local` con:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_SUPABASE_ANON_KEY
```

Si ya habias creado las tablas antes, vuelve a ejecutar `database/schema.sql`.
El archivo agrega perfil, columnas nuevas y reglas sin borrar tus datos existentes.

## Correr localmente

```bash
npm run dev
```

Luego abre:

```text
http://localhost:3000
```

## Publicar sin afectar la landing

Esta app vive en la carpeta `nyfrom-app`. Se puede subir como proyecto separado en Vercel para probarla con una URL preview antes de conectarla al dominio principal.
