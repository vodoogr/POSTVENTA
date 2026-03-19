/* ============================================
   RECOMMENDATIONS — Smart action suggestions
   ============================================ */
const Recommendations = (() => {

    function generate(defectiveData, supplierMetrics, config) {
        const actions = [];

        // 1. Supplier-level recommendations
        supplierMetrics.forEach((sup, idx) => {
            // High-value supplier claims
            if (sup.totalValorStock > (config.umbralValorReclamacion || 500)) {
                actions.push({
                    id: `REC-SUP-${idx}`,
                    type: 'reclamar',
                    priority: sup.totalValorStock > 5000 ? 'alta' : sup.totalValorStock > 1000 ? 'media' : 'baja',
                    title: `Reclamar a ${sup.nombre}`,
                    description: `${sup.numReferencias} referencias defectuosas con un valor total de ${formatCurrency(sup.totalValorStock)}. Antigüedad media: ${sup.antiguedadMedia} días.`,
                    proveedor: sup.nombre,
                    producto: null,
                    valorImpacto: sup.totalValorStock,
                    actionType: 'claim',
                    done: false
                });
            }

            // Block future purchases for high-defect suppliers
            if (sup.numReferencias > 10) {
                actions.push({
                    id: `REC-BLK-${idx}`,
                    type: 'bloquear',
                    priority: 'alta',
                    title: `Bloquear compras a ${sup.nombre}`,
                    description: `Proveedor con ${sup.numReferencias} referencias defectuosas. Valor acumulado: ${formatCurrency(sup.totalValorStock)}.`,
                    proveedor: sup.nombre,
                    producto: null,
                    valorImpacto: sup.totalValorStock,
                    actionType: 'block',
                    done: false
                });
            }
        });

        // 2. Product-level recommendations
        defectiveData.forEach((prod, idx) => {
            // Recent defective — claim to supplier
            if (prod._antiguedadDias < 90 && prod._valorStock > 100) {
                actions.push({
                    id: `REC-DEV-${idx}`,
                    type: 'devolucion',
                    priority: 'alta',
                    title: `Negociar devolución: [${prod['Cod.Artículo'] || prod['Cod.Articulo'] || ''}] ${prod['Artículo'] || prod['Articulo'] || prod['Cod.Artículo']}`,
                    description: `Stock reciente (${prod._antiguedadDias} días). Proveedor: ${prod['Proveedor']}. Valor: ${formatCurrency(prod._valorStock)}.`,
                    proveedor: prod['Proveedor'],
                    producto: prod['Artículo'] || prod['Articulo'],
                    valorImpacto: prod._valorStock,
                    actionType: 'return',
                    done: false
                });
            }

            // High value stagnant — liquidate
            if (prod._diasSinVenta > (config.periodoSinRotacion || 180) && prod._valorStock > 200) {
                actions.push({
                    id: `REC-LIQ-${idx}`,
                    type: 'liquidar',
                    priority: prod._valorStock > 1000 ? 'alta' : 'media',
                    title: `Liquidar: [${prod['Cod.Artículo'] || prod['Cod.Articulo'] || ''}] ${prod['Artículo'] || prod['Articulo'] || prod['Cod.Artículo']}`,
                    description: `Sin ventas en ${prod._diasSinVenta} días. Stock: ${prod._stock} uds. Valor inmovilizado: ${formatCurrency(prod._valorStock)}.`,
                    proveedor: prod['Proveedor'],
                    producto: prod['Artículo'] || prod['Articulo'],
                    valorImpacto: prod._valorStock,
                    actionType: 'liquidate',
                    done: false
                });
            }

            // Relocate to different channel
            if (prod._stock > 50 && prod._diasSinVenta > 90) {
                actions.push({
                    id: `REC-RUB-${idx}`,
                    type: 'reubicar',
                    priority: 'baja',
                    title: `Reubicar: [${prod['Cod.Artículo'] || prod['Cod.Articulo'] || ''}] ${prod['Artículo'] || prod['Articulo'] || prod['Cod.Artículo']}`,
                    description: `Alto volumen (${prod._stock} uds) sin rotación. Considerar canal alternativo de venta o envío a otro almacén.`,
                    proveedor: prod['Proveedor'],
                    producto: prod['Artículo'] || prod['Articulo'],
                    valorImpacto: prod._valorStock,
                    actionType: 'relocate',
                    done: false
                });
            }
        });

        // Sort by priority then value
        const priorityOrder = { alta: 0, media: 1, baja: 2 };
        actions.sort((a, b) => {
            const pDiff = (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
            if (pDiff !== 0) return pDiff;
            return b.valorImpacto - a.valorImpacto;
        });

        // Deduplicate by keeping unique combinations
        const seen = new Set();
        return actions.filter(a => {
            const key = `${a.type}-${a.proveedor}-${a.producto || 'all'}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function formatCurrency(n) {
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
    }

    return { generate };
})();
