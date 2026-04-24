import React from 'react';
import { 
  Document, 
  Page, 
  Text, 
  View, 
  StyleSheet, 
  Image, 
  Font 
} from '@react-pdf/renderer';
import { PDFModel } from '../services/pdfAdapter.service';

// Estilos profesionales para grado ERP
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#334155',
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottom: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 10,
  },
  logo: {
    width: 60,
    height: 60,
  },
  headerTextContainer: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#1E293B',
  },
  subtitle: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    color: '#0F172A',
    textTransform: 'uppercase',
    backgroundColor: '#F8FAFC',
    padding: 4,
  },

  table: {
    display: 'flex',
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomColor: '#F1F5F9',
    borderBottomWidth: 1,
    alignItems: 'center',
    minHeight: 24,
    paddingVertical: 4,
  },
  tableHeader: {
    backgroundColor: '#F8FAFC',
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
  },
  col1: { width: '8%' }, // Checkbox / Id
  col2: { width: '15%' }, // Cantidad
  col3: { width: '45%' }, // Descripción
  col4: { width: '17%' }, // Precio/Unidad human
  col5: { width: '15%', textAlign: 'right' }, // Total

  checkbox: {
    width: 12,
    height: 12,
    border: 1,
    borderColor: '#94A3B8',
    marginRight: 10,
  },
  
  instructionsArea: {
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 4,
    border: 1,
    borderColor: '#E2E8F0',
  },
  instructionsText: {
    lineHeight: 1.5,
    fontSize: 10,
  },

  allergenBadge: {
    padding: '4 8',
    backgroundColor: '#FFFFFF',
    border: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  allergenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#06b6d4',
    marginRight: 4,
  },
  allergenText: {
    fontSize: 8,
    fontWeight: 'bold',
  },
  allergenContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },

  financialSummary: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  financialTotal: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#CBD5E1',
    paddingTop: 8,
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
  },

  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
  },
  qrCode: {
    width: 60,
    height: 60,
  },
  footerMeta: {
    fontSize: 8,
    color: '#94A3B8',
  }
});

interface RecipePDFProps {
  data: PDFModel;
  mode: 'kitchen' | 'manager';
}

const RecipePDF: React.FC<RecipePDFProps> = ({ data, mode }) => {
  return (
    <Document title={`Ficha-${data.identity.name}-${data.identity.version}`}>
      <Page size="A4" style={styles.page}>
        {/* HEADER */}
        <View style={styles.header}>
          <Image src="/logo.png" style={styles.logo} />
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>{data.identity.name}</Text>
            <Text style={styles.subtitle}>Versión: {data.identity.version} | Modificado: {data.identity.generatedAt}</Text>
            <Text style={styles.subtitle}>Raciones teóricas: {data.identity.portions}</Text>
          </View>
        </View>

        {/* CONTENIDO OPERATIVO */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ingredientes y Cantidades</Text>
          <View style={styles.table}>
            {/* Table Header */}
            <View style={[styles.tableRow, styles.tableHeader]}>
              <View style={styles.col1}><Text>{mode === 'kitchen' ? 'Ok' : '#'}</Text></View>
              <View style={styles.col2}><Text>Cantidad</Text></View>
              <View style={styles.col3}><Text>Descripción</Text></View>
              {mode === 'manager' && (
                <>
                  <View style={styles.col4}><Text>Coste Unit.</Text></View>
                  <View style={styles.col5}><Text>Total</Text></View>
                </>
              )}
            </View>

            {/* Table Body */}
            {data.kitchen.ingredients.map((ing, idx) => (
              <View key={idx} style={styles.tableRow}>
                <View style={styles.col1}>
                  {mode === 'kitchen' ? <View style={styles.checkbox} /> : <Text>{idx + 1}</Text>}
                </View>
                <View style={[styles.col2, mode === 'kitchen' ? {fontSize: 12, fontFamily: 'Helvetica-Bold'} : {}]}>
                  <Text>{ing.quantity} {ing.unit}</Text>
                </View>
                <View style={styles.col3}>
                  <Text>{ing.name}</Text>
                </View>
                {mode === 'manager' && (
                  <>
                    <View style={styles.col4}><Text>{ing.costPerHumanUnit} €/{ing.humanUnit}</Text></View>
                    <View style={styles.col5}><Text>{ing.totalCost} €</Text></View>
                  </>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* INSTRUCCIONES */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Instrucciones de Preparación</Text>
          <View style={styles.instructionsArea}>
            <Text style={styles.instructionsText}>{data.kitchen.instructions}</Text>
          </View>
        </View>

        {/* ALÉRGENOS */}
        {data.kitchen.allergens.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Alérgenos Presentes (Reg. UE 1169/2011)</Text>
            <View style={styles.allergenContainer}>
              {data.kitchen.allergens.map((alg, i) => (
                <View key={i} style={styles.allergenBadge}>
                  <View style={styles.allergenDot} />
                  <Text style={styles.allergenText}>{alg}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* BLOQUE FINANCIERO (MANAGER ONLY) */}
        {mode === 'manager' && (
          <View style={styles.financialSummary}>
            <Text style={{fontWeight: 'bold', marginBottom: 10, fontSize: 12}}>Resumen de Costes y Auditoría</Text>
            <View style={styles.financialRow}>
              <Text>Coste Directo (Ingredientes + Subrecetas):</Text>
              <Text>{data.manager.directCost} €</Text>
            </View>
            <View style={styles.financialRow}>
              <Text>Costes Indirectos Aplicados:</Text>
              <Text>{data.manager.indirectCostsValue} €</Text>
            </View>
            <View style={styles.financialRow}>
              <Text>Fuente de datos de costes:</Text>
              <Text>{data.manager.costSnapshotSource === 'inventory_wac' ? 'Inventario Real (PMP)' : 'Estimado Manual'}</Text>
            </View>
            <View style={[styles.financialRow, styles.financialTotal]}>
              <Text>COSTE TOTAL RECETA ({data.identity.portions} rac.):</Text>
              <Text>{data.manager.totalCost} €</Text>
            </View>
            <View style={[styles.financialRow, {marginTop: 5}]}>
              <Text style={{fontFamily: 'Helvetica-Bold'}}>COSTE POR RACIÓN:</Text>
              <Text style={{fontFamily: 'Helvetica-Bold'}}>{data.manager.costPerPortion} €</Text>
            </View>
          </View>
        )}

        {/* FOOTER */}
        <View style={styles.footer}>
          <View>
            <Text style={styles.footerMeta}>Sistema: Escandallo ERP Professional</Text>
            <Text style={styles.footerMeta}>Escanea el código para ver versión digital o variantes en tiempo real.</Text>
          </View>
          <Image src={data.identity.qrDataUrl} style={styles.qrCode} />
        </View>
      </Page>
    </Document>
  );
};

export default RecipePDF;
