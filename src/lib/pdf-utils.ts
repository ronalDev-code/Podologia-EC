import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const VERDE = [15, 110, 86] as [number, number, number]
const VERDE_CLARO = [225, 245, 238] as [number, number, number]

export interface ConfigConsultorio {
  nombre: string
  telefono: string
  direccion: string
  logoUrl: string | null
}

async function cargarConfig(): Promise<ConfigConsultorio> {
  try {
    const { doc, getDoc } = await import('firebase/firestore')
    const { db } = await import('./firebase')
    const snap = await getDoc(doc(db, 'config', 'consultorio'))
    if (snap.exists()) return snap.data() as ConfigConsultorio
  } catch {}
  return {
    nombre: 'Centro Podológico Erika Correa',
    telefono: '',
    direccion: '',
    logoUrl: null,
  }
}

async function agregarHeader(
  pdf: jsPDF,
  config: ConfigConsultorio,
  subtitulo: string,
  fecha: string
): Promise<number> {
  // Fondo verde header
  pdf.setFillColor(...VERDE)
  pdf.rect(0, 0, 210, 38, 'F')

  // Logo si existe
  let textoX = 14
  if (config.logoUrl) {
    try {
      // Convertir URL a base64
      const response = await fetch(config.logoUrl)
      const blob = await response.blob()
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
      pdf.addImage(base64, 'PNG', 10, 4, 30, 30)
      textoX = 46
    } catch {
      // Si falla la carga del logo, continúa sin él
    }
  }

  // Textos header
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(16)
  pdf.setFont('helvetica', 'bold')
  pdf.text(config.nombre || 'Centro Podológico Erika Correa', textoX, 14)

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.text(subtitulo, textoX, 22)

  if (config.telefono || config.direccion) {
    const contacto = [config.telefono, config.direccion]
      .filter(Boolean).join(' · ')
    pdf.text(contacto, textoX, 29)
  }

  pdf.text(fecha, textoX, 36)

  return 48 // Y donde empieza el contenido
}

function agregarPie(pdf: jsPDF) {
  pdf.setFontSize(8)
  pdf.setTextColor(150, 150, 150)
  pdf.text('Desarrollado por RonalDev', 14, 287)
  pdf.text(
    `Generado: ${new Date().toLocaleString('es-PE')}`,
    130, 287
  )
}

// ── PDF HISTORIA CLÍNICA ─────────────────────────────────
export async function generarPDFHistoria(
  paciente: {
    nombre: string
    apellido: string
    dni: string
    edad: number
    telefono: string
    ocupacion: string
    calzadoHabitual: string
    motivoConsulta: string
    antecedentes: {
      diabetes: boolean
      hipertension: boolean
      problemasCirculatorios: boolean
      alergias: string
      otros: string
    }
  },
  historia: {
    diagnostico: string
    planTerapeutico: string
    examenDermatologico: {
      resequedad: boolean
      grietas: boolean
      micosis: boolean
      hiperqueratosis: boolean
      otras: string
    }
    examenOrtopodologico: {
      tipoPie: string
      juanetes: boolean
      dedosEnGarra: boolean
      dedosEnMartillo: boolean
      otras: string
    }
    examenVascularNeurologico: {
      pulsoNormal: boolean
      sensibilidadNormal: boolean
      observaciones: string
    }
    fechaCreacion?: unknown
  } | null,
  evoluciones: {
    fecha: unknown
    notaClinica: string
    medicamentos: string
    tratamientosAplicados: { tipo: string }[]
    cobro: { monto: number; medioPago: string; concepto: string }
  }[]
) {
  const config = await cargarConfig()
  const pdf = new jsPDF()

  const fechaHoy = new Date().toLocaleDateString('es-PE', {
    day: '2-digit', month: 'long', year: 'numeric'
  })

  let y = await agregarHeader(
    pdf, config,
    'Historia Clínica Podológica',
    `Emitido: ${fechaHoy}`
  )

  // ── DATOS DEL PACIENTE ──
  pdf.setTextColor(0, 0, 0)
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(...VERDE)
  pdf.text('DATOS DEL PACIENTE', 14, y)
  y += 4

  autoTable(pdf, {
    startY: y,
    head: [],
    body: [
      ['Nombre completo',
        `${paciente.nombre} ${paciente.apellido}`],
      ['DNI', paciente.dni],
      ['Edad', `${paciente.edad} años`],
      ['Teléfono', paciente.telefono || '—'],
      ['Ocupación', paciente.ocupacion || '—'],
      ['Calzado habitual', paciente.calzadoHabitual || '—'],
      ['Motivo de consulta', paciente.motivoConsulta || '—'],
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold',
        fillColor: [245, 245, 245] },
      1: { cellWidth: 130 },
    },
  })
  y = (pdf as unknown as {
    lastAutoTable: { finalY: number }
  }).lastAutoTable.finalY + 6

  // ── ANTECEDENTES ──
  const antList = []
  if (paciente.antecedentes?.diabetes) antList.push('Diabetes')
  if (paciente.antecedentes?.hipertension) antList.push('Hipertensión')
  if (paciente.antecedentes?.problemasCirculatorios)
    antList.push('Problemas circulatorios')
  if (paciente.antecedentes?.alergias)
    antList.push(`Alergias: ${paciente.antecedentes.alergias}`)
  if (paciente.antecedentes?.otros)
    antList.push(`Otros: ${paciente.antecedentes.otros}`)

  if (antList.length > 0) {
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(...VERDE)
    pdf.text('ANTECEDENTES PATOLÓGICOS', 14, y)
    y += 4

    autoTable(pdf, {
      startY: y,
      head: [],
      body: antList.map(a => [a]),
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      didParseCell: (data) => {
        data.cell.styles.fillColor = [254, 242, 242]
        data.cell.styles.textColor = [185, 28, 28]
        data.cell.styles.fontStyle = 'bold'
      },
    })
    y = (pdf as unknown as {
      lastAutoTable: { finalY: number }
    }).lastAutoTable.finalY + 6
  }

  // ── EXPLORACIÓN FÍSICA ──
  if (historia) {
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(...VERDE)
    pdf.text('EXPLORACIÓN FÍSICA', 14, y)
    y += 4

    const derma = []
    if (historia.examenDermatologico?.resequedad)
      derma.push('Resequedad')
    if (historia.examenDermatologico?.grietas) derma.push('Grietas')
    if (historia.examenDermatologico?.micosis)
      derma.push('Micosis/Hongos')
    if (historia.examenDermatologico?.hiperqueratosis)
      derma.push('Hiperqueratosis')
    if (historia.examenDermatologico?.otras)
      derma.push(historia.examenDermatologico.otras)

    const orto = []
    orto.push(`Tipo de pie: ${historia.examenOrtopodologico?.tipoPie || 'normal'}`)
    if (historia.examenOrtopodologico?.juanetes)
      orto.push('Juanetes')
    if (historia.examenOrtopodologico?.dedosEnGarra)
      orto.push('Dedos en garra')
    if (historia.examenOrtopodologico?.dedosEnMartillo)
      orto.push('Dedos en martillo')
    if (historia.examenOrtopodologico?.otras)
      orto.push(historia.examenOrtopodologico.otras)

    autoTable(pdf, {
      startY: y,
      head: [],
      body: [
        ['Examen dermatológico',
          derma.length ? derma.join(', ') : 'Sin hallazgos'],
        ['Examen ortopodológico', orto.join(', ')],
        ['Pulso',
          historia.examenVascularNeurologico?.pulsoNormal
            ? 'Normal' : 'Alterado'],
        ['Sensibilidad',
          historia.examenVascularNeurologico?.sensibilidadNormal
            ? 'Normal' : 'Alterada'],
        ['Obs. vasculares',
          historia.examenVascularNeurologico?.observaciones || '—'],
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold',
          fillColor: [245, 245, 245] },
        1: { cellWidth: 130 },
      },
    })
    y = (pdf as unknown as {
      lastAutoTable: { finalY: number }
    }).lastAutoTable.finalY + 6

    // ── DIAGNÓSTICO ──
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(...VERDE)
    pdf.text('DIAGNÓSTICO Y PLAN TERAPÉUTICO', 14, y)
    y += 4

    autoTable(pdf, {
      startY: y,
      head: [],
      body: [
        ['Diagnóstico', historia.diagnostico || '—'],
        ['Plan terapéutico', historia.planTerapeutico || '—'],
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold',
          fillColor: [245, 245, 245] },
        1: { cellWidth: 130 },
      },
    })
    y = (pdf as unknown as {
      lastAutoTable: { finalY: number }
    }).lastAutoTable.finalY + 6
  }

  // ── HISTORIAL DE EVOLUCIONES ──
  if (evoluciones.length > 0) {
    // Nueva página si no hay espacio
    if (y > 220) {
      pdf.addPage()
      y = 20
    }

    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(...VERDE)
    pdf.text('HISTORIAL DE EVOLUCIONES', 14, y)
    y += 4

    const evolData = evoluciones.map((ev, i) => {
      const fecha = ev.fecha
      let fechaStr = '—'
      try {
        const ts = fecha as { toDate?: () => Date }
        const d = ts.toDate ? ts.toDate() : new Date(fecha as string)
        fechaStr = d.toLocaleDateString('es-PE', {
          day: '2-digit', month: 'short', year: 'numeric'
        })
      } catch {}

      const tratas = (ev.tratamientosAplicados || [])
        .map((t: { tipo: string }) => t.tipo).join(', ')

      return [
        String(evoluciones.length - i),
        fechaStr,
        ev.notaClinica?.substring(0, 50) || '—',
        tratas || '—',
        ev.cobro?.monto
          ? `S/ ${ev.cobro.monto.toFixed(2)} (${ev.cobro.medioPago})`
          : '—',
      ]
    })

    autoTable(pdf, {
      startY: y,
      head: [['#', 'Fecha', 'Nota clínica', 'Tratamientos', 'Cobro']],
      body: evolData,
      theme: 'striped',
      headStyles: { fillColor: VERDE, fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 25 },
        2: { cellWidth: 70 },
        3: { cellWidth: 45 },
        4: { cellWidth: 32 },
      },
    })
  }

  agregarPie(pdf)
  pdf.save(
    `historia-${paciente.apellido}-${paciente.dni}.pdf`
  )
}

// ── PDF CAJA ─────────────────────────────────────────────
export async function generarPDFCaja(
  caja: {
    fecha: unknown
    montoInicial: number
    cobros: {
      id: string
      pacienteNombre: string
      concepto: string
      monto: number
      medioPago: string
      hora: unknown
    }[]
    totalEfectivo: number
    totalTarjeta: number
    totalTransferencia: number
    totalYape: number
    totalPlin: number
    totalGeneral: number
    cerrada: boolean
    efectivoContado?: number
    efectivoEsperado?: number
    diferencia?: number
  }
) {
  const config = await cargarConfig()
  const pdf = new jsPDF()

  function fmt(fecha: unknown): string {
    if (!fecha) return '—'
    try {
      const ts = fecha as { toDate?: () => Date }
      const d = ts.toDate ? ts.toDate() : new Date(fecha as string)
      return d.toLocaleDateString('es-PE', {
        weekday: 'long', day: '2-digit',
        month: 'long', year: 'numeric'
      })
    } catch { return '—' }
  }

  function fmtHora(hora: unknown): string {
    if (!hora) return '—'
    try {
      const ts = hora as { toDate?: () => Date }
      const d = ts.toDate ? ts.toDate() : new Date(hora as string)
      return d.toLocaleTimeString('es-PE', {
        hour: '2-digit', minute: '2-digit'
      })
    } catch { return '—' }
  }

  let y = await agregarHeader(
    pdf, config,
    `Cierre de Caja — ${caja.cerrada ? 'CERRADA' : 'EN CURSO'}`,
    fmt(caja.fecha)
  )

  // ── RESUMEN INGRESOS ──
  pdf.setTextColor(...VERDE)
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.text('RESUMEN DE INGRESOS', 14, y)
  y += 4

  autoTable(pdf, {
    startY: y,
    head: [],
    body: [
      ['Fondo inicial de caja',
        `S/ ${(caja.montoInicial || 0).toFixed(2)}`],
      ['Cobros en efectivo',
        `S/ ${(caja.totalEfectivo || 0).toFixed(2)}`],
      ['Cobros con tarjeta',
        `S/ ${(caja.totalTarjeta || 0).toFixed(2)}`],
      ['Transferencias',
        `S/ ${(caja.totalTransferencia || 0).toFixed(2)}`],
      ['Yape', `S/ ${(caja.totalYape || 0).toFixed(2)}`],
      ['Plin', `S/ ${(caja.totalPlin || 0).toFixed(2)}`],
      ['TOTAL INGRESOS DEL DÍA',
        `S/ ${(caja.totalGeneral || 0).toFixed(2)}`],
    ],
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 110 },
      1: { cellWidth: 60, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.row.index === 6) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = VERDE_CLARO
        data.cell.styles.textColor = VERDE
      }
    },
  })
  y = (pdf as unknown as {
    lastAutoTable: { finalY: number }
  }).lastAutoTable.finalY + 8

  // ── CUADRE DE EFECTIVO ──
  if (caja.efectivoContado !== undefined) {
    pdf.setTextColor(...VERDE)
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'bold')
    pdf.text('CUADRE DE EFECTIVO', 14, y)
    y += 4

    const dif = caja.diferencia || 0
    autoTable(pdf, {
      startY: y,
      head: [],
      body: [
        ['Efectivo esperado en caja',
          `S/ ${(caja.efectivoEsperado || 0).toFixed(2)}`],
        ['Efectivo contado físicamente',
          `S/ ${(caja.efectivoContado || 0).toFixed(2)}`],
        [dif >= 0 ? 'SOBRANTE' : 'FALTANTE',
          `S/ ${Math.abs(dif).toFixed(2)}`],
      ],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: {
        0: { cellWidth: 110 },
        1: { cellWidth: 60, halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.row.index === 2) {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fillColor = dif >= 0
            ? [220, 252, 231] : [254, 226, 226]
          data.cell.styles.textColor = dif >= 0
            ? [22, 101, 52] : [185, 28, 28]
        }
      },
    })
    y = (pdf as unknown as {
      lastAutoTable: { finalY: number }
    }).lastAutoTable.finalY + 8
  }

  // ── DETALLE DE COBROS ──
  pdf.setTextColor(...VERDE)
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.text(`DETALLE DE COBROS (${caja.cobros?.length || 0} atenciones)`,
    14, y)
  y += 4

  const cobrosData = (caja.cobros || []).map(c => [
    fmtHora(c.hora),
    c.pacienteNombre || '—',
    c.concepto || '—',
    c.medioPago || '—',
    `S/ ${(c.monto || 0).toFixed(2)}`,
  ])

  autoTable(pdf, {
    startY: y,
    head: [['Hora', 'Paciente', 'Concepto', 'Medio pago', 'Monto']],
    body: cobrosData.length
      ? cobrosData
      : [['—', '—', 'Sin cobros registrados', '—', 'S/ 0.00']],
    theme: 'striped',
    headStyles: { fillColor: VERDE, fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 45 },
      2: { cellWidth: 55 },
      3: { cellWidth: 28 },
      4: { cellWidth: 24, halign: 'right' },
    },
  })

  agregarPie(pdf)
  pdf.save(
    `caja-${new Date().toISOString().split('T')[0]}.pdf`
  )
}

// ── PDF REPORTE MENSUAL ───────────────────────────────────
export async function generarPDFReporte(
  mes: number,
  anio: number,
  meses: string[],
  resumen: {
    totalIngresos: number
    totalEfectivo: number
    totalTarjeta: number
    totalTransferencia: number
    totalYape: number
    totalPlin: number
    totalAtenciones: number
    cajasDelMes: number
  },
  tratamientos: { tipo: string; count: number }[],
  pacienteStats: { nuevos: number; recurrentes: number },
  tratamientoLabel: Record<string, string>
) {
  const config = await cargarConfig()
  const pdf = new jsPDF()

  let y = await agregarHeader(
    pdf, config,
    `Reporte Mensual — ${meses[mes]} ${anio}`,
    `Generado: ${new Date().toLocaleDateString('es-PE')}`
  )

  // ── RESUMEN GENERAL ──
  pdf.setTextColor(...VERDE)
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.text('RESUMEN GENERAL', 14, y)
  y += 4

  autoTable(pdf, {
    startY: y,
    head: [],
    body: [
      ['Total ingresos del mes',
        `S/ ${resumen.totalIngresos.toFixed(2)}`],
      ['Total atenciones realizadas',
        String(resumen.totalAtenciones)],
      ['Días trabajados', String(resumen.cajasDelMes)],
      ['Promedio por atención',
        resumen.totalAtenciones > 0
          ? `S/ ${(resumen.totalIngresos / resumen.totalAtenciones).toFixed(2)}`
          : 'S/ 0.00'],
    ],
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 110 },
      1: { cellWidth: 60, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.row.index === 0) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = VERDE_CLARO
        data.cell.styles.textColor = VERDE
      }
    },
  })
  y = (pdf as unknown as {
    lastAutoTable: { finalY: number }
  }).lastAutoTable.finalY + 8

  // ── INGRESOS POR MEDIO DE PAGO ──
  pdf.setTextColor(...VERDE)
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.text('INGRESOS POR MEDIO DE PAGO', 14, y)
  y += 4

  autoTable(pdf, {
    startY: y,
    head: [['Medio de pago', 'Monto', 'Porcentaje']],
    body: [
      ['Efectivo',
        `S/ ${resumen.totalEfectivo.toFixed(2)}`,
        resumen.totalIngresos > 0
          ? `${Math.round((resumen.totalEfectivo / resumen.totalIngresos) * 100)}%`
          : '0%'],
      ['Tarjeta',
        `S/ ${resumen.totalTarjeta.toFixed(2)}`,
        resumen.totalIngresos > 0
          ? `${Math.round((resumen.totalTarjeta / resumen.totalIngresos) * 100)}%`
          : '0%'],
      ['Transferencia',
        `S/ ${resumen.totalTransferencia.toFixed(2)}`,
        resumen.totalIngresos > 0
          ? `${Math.round((resumen.totalTransferencia / resumen.totalIngresos) * 100)}%`
          : '0%'],
      ['Yape',
        `S/ ${resumen.totalYape.toFixed(2)}`,
        resumen.totalIngresos > 0
          ? `${Math.round((resumen.totalYape / resumen.totalIngresos) * 100)}%`
          : '0%'],
      ['Plin',
        `S/ ${resumen.totalPlin.toFixed(2)}`,
        resumen.totalIngresos > 0
          ? `${Math.round((resumen.totalPlin / resumen.totalIngresos) * 100)}%`
          : '0%'],
    ],
    theme: 'striped',
    headStyles: { fillColor: VERDE, fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 60, halign: 'right' },
      2: { cellWidth: 30, halign: 'center' },
    },
  })
  y = (pdf as unknown as {
    lastAutoTable: { finalY: number }
  }).lastAutoTable.finalY + 8

  // ── TRATAMIENTOS ──
  if (y > 220) { pdf.addPage(); y = 20 }

  pdf.setTextColor(...VERDE)
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.text('TRATAMIENTOS REALIZADOS', 14, y)
  y += 4

  autoTable(pdf, {
    startY: y,
    head: [['Tratamiento', 'Cantidad']],
    body: tratamientos.length
      ? tratamientos.map(t => [
          tratamientoLabel[t.tipo] || t.tipo,
          String(t.count)
        ])
      : [['Sin tratamientos registrados', '0']],
    theme: 'striped',
    headStyles: { fillColor: VERDE, fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 50, halign: 'center' },
    },
  })
  y = (pdf as unknown as {
    lastAutoTable: { finalY: number }
  }).lastAutoTable.finalY + 8

  // ── PACIENTES ──
  pdf.setTextColor(...VERDE)
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.text('PACIENTES DEL MES', 14, y)
  y += 4

  autoTable(pdf, {
    startY: y,
    head: [],
    body: [
      ['Total pacientes atendidos',
        String(pacienteStats.nuevos + pacienteStats.recurrentes)],
      ['Pacientes nuevos', String(pacienteStats.nuevos)],
      ['Pacientes recurrentes', String(pacienteStats.recurrentes)],
    ],
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 110 },
      1: { cellWidth: 60, halign: 'center' },
    },
  })

  agregarPie(pdf)
  pdf.save(
    `reporte-${meses[mes].toLowerCase()}-${anio}.pdf`
  )
}