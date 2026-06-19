// ── USUARIO ──────────────────────────────────────────────
export interface Usuario {
  uid: string
  nombre: string
  email: string
  activo: boolean
  creadoPor: string
  fechaCreacion: Date
}

// ── PACIENTE ─────────────────────────────────────────────
export interface Paciente {
  id: string
  dni: string
  nombre: string
  apellido: string
  edad: number
  telefono: string
  ocupacion: string
  calzadoHabitual: string
  motivoConsulta: string
  antecedentes: Antecedentes
  fechaRegistro: Date
  ultimaVisita?: Date
}

export interface Antecedentes {
  diabetes: boolean
  hipertension: boolean
  problemasCirculatorios: boolean
  alergias: string // descripción libre
  otros: string
}

// ── HISTORIA CLÍNICA ─────────────────────────────────────
export interface Historia {
  id: string
  pacienteId: string
  motivoConsulta: string
  examenDermatologico: ExamenDermatologico
  examenOrtopodologico: ExamenOrtopodologico
  examenVascularNeurologico: ExamenVascularNeurologico
  diagnostico: string
  planTerapeutico: string
  fechaCreacion: Date
}

export interface ExamenDermatologico {
  resequedad: boolean
  grietas: boolean
  micosis: boolean
  hiperqueratosis: boolean
  otras: string
}

export interface ExamenOrtopodologico {
  tipoPie: 'plano' | 'cavo' | 'normal'
  juanetes: boolean
  dedosEnGarra: boolean
  dedosEnMartillo: boolean
  otras: string
}

export interface ExamenVascularNeurologico {
  pulsoNormal: boolean
  sensibilidadNormal: boolean
  observaciones: string
}

// ── EVOLUCIÓN ────────────────────────────────────────────
export interface Evolucion {
  id: string
  pacienteId: string
  historiaId: string
  fecha: Date
  notaClinica: string
  medicamentos: string
  tratamientosAplicados: TratamientoAplicado[]
  sesionesEspeciales: SesionEspecial[]
  fotos: FotosTratamiento
  cobro: Cobro
  creadoPor: string
}

export interface TratamientoAplicado {
  tipo: 'quiropodia' | 'fresado' | 'curacion' | 'corteUnas' | 'otro'
  descripcion: string
}

// ── SESIONES ESPECIALES (placas, ozono, laser) ───────────
export interface SesionEspecial {
  id: string
  evolucionId: string
  pacienteId: string
  tipo: 'placa_antimicotica' | 'ozono' | 'laser'
  sesiones: Sesion[]  // máximo 10
}

// DESPUÉS
export interface Sesion {
  numero: number
  fecha: string | null
  estado: 'pendiente' | 'realizado'
  observacion: string
}

// ── FOTOS ────────────────────────────────────────────────
export interface FotosTratamiento {
  antes: string | null    // URL Cloudinary
  intermedio: string | null
  despues: string | null
}

// ── COBRO ────────────────────────────────────────────────
export interface Cobro {
  monto: number
  medioPago: 'efectivo' | 'tarjeta' | 'transferencia' | 'yape' | 'plin'
  concepto: string
}

// ── CAJA ─────────────────────────────────────────────────
export interface Caja {
  id: string
  fecha: Date
  montoInicial: number
  cobros: RegistroCobro[]
  cerrada: boolean
  totalEfectivo: number
  totalTarjeta: number
  totalTransferencia: number
  totalYape: number
  totalPlin: number
  totalGeneral: number
  creadoPor: string
  fechaCierre?: Date
}

export interface RegistroCobro {
  id: string
  pacienteNombre: string
  concepto: string
  monto: number
  medioPago: 'efectivo' | 'tarjeta' | 'transferencia' | 'yape' | 'plin'
  hora: Date
}

// ── CONFIG CONSULTORIO ───────────────────────────────────
export interface ConfigConsultorio {
  nombre: string
  logoUrl: string | null
  telefono: string
  direccion: string
}

// ── PAGINACIÓN ───────────────────────────────────────────
export interface Paginacion<T> {
  data: T[]
  ultimoDocumento: unknown | null  // cursor Firestore
  hayMas: boolean
}