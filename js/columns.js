/* ============================================
   COLUMN RESOLVER
   Maps flexible CSV/Excel column names to the
   canonical names used internally by the app.
   ============================================ */
const ColumnResolver = (() => {

    /**
     * Mapping: canonical name → array of possible column names (case-insensitive).
     * The first match wins. Order matters (most specific first).
     */

    // === STOCK columns ===
    const STOCK_MAP = {
        'Cod.Artículo': ['cod.artículo', 'cod.articulo', 'codarticulo', 'codart', 'código artículo', 'codigo articulo', 'cod_artic', 'cod artic', 'art_cod', 'código', 'codigo', 'code'],
        'Artículo': ['artículo', 'articulo', 'descripción artículo', 'descripcion articulo', 'desc_artic', 'desc artic', 'nombre artículo', 'nombre articulo', 'descripción', 'descripcion', 'articulo_desc'],
        'RefProv': ['refprov', 'ref.prov', 'ref prov', 'referencia proveedor', 'ref_proveedor', 'ref proveedor', 'referencia_prov'],
        'Ean13': ['ean13', 'ean', 'ean-13', 'código barras', 'codigo barras', 'barcode', 'codbarras'],
        'DMarca': ['dmarca', 'marca', 'd_marca', 'nombre_marca', 'brand'],
        'DFamil_N1': ['dfamil_n1', 'dfamil n1', 'familia', 'fam_n1', 'familia nivel 1', 'familia_n1', 'categoría', 'categoria', 'category'],
        'DFamil_N2': ['dfamil_n2', 'dfamil n2', 'subfamilia', 'fam_n2', 'familia nivel 2', 'familia_n2', 'subcategoría', 'subcategoria'],
        'Clasificación': ['clasificación', 'clasificacion', 'clasif', 'tipo clasificación', 'tipo clasificacion', 'classification'],
        'DescAlmacenStock': ['descalmacenstock', 'desc almacen stock', 'almacén', 'almacen', 'warehouse', 'desc_almacen', 'nombre almacén', 'nombre almacen'],
        'LVenta': ['lventa', 'l_venta', 'l venta', 'linea venta', 'línea venta'],
        'Stock': ['stock', 'stock actual', 'cantidad stock', 'stockactual', 'unidades', 'qty', 'cantidad'],
        'StockDisp': ['stockdisp', 'stock disp', 'stock disponible', 'stockdisponible', 'disponible'],
        'PrecioAdq_Artic': ['precioadq_artic', 'precioadq', 'precio adq', 'precio adquisición', 'precio adquisicion', 'precio_adquisicion', 'coste', 'costo', 'coste unitario', 'price_cost', 'precio compra', 'preciocompra'],
        'PrecioInvent': ['precioinvent', 'precio invent', 'precio inventario', 'precioinventario', 'precio_inventario', 'valoracion'],
        'PVP_artic': ['pvp_artic', 'pvp artic', 'pvp', 'precio venta', 'precio_venta', 'precioventa', 'pvp_articulo'],
        '%MB-Stock': ['%mb-stock', '%mb stock', 'mb-stock', 'mb stock', 'margen bruto', 'margen', '%margen', 'margen_bruto', '%mb'],
        'UltFechaAlbCompra': ['ultfechaalbcompra', 'ult fecha alb compra', 'ultima compra', 'última compra', 'fecha ultima compra', 'fecha última compra', 'ult_fecha_compra', 'fec_ult_compra', 'last_purchase', 'fecha compra'],
        'UltFechaAlbVenta': ['ultfechaalbventa', 'ult fecha alb venta', 'ultima venta', 'última venta', 'fecha ultima venta', 'fecha última venta', 'ult_fecha_venta', 'fec_ult_venta', 'last_sale', 'fecha venta'],
        'ArticActivo': ['articactivo', 'artic activo', 'activo', 'articulo activo', 'artículo activo', 'active'],
        'Obsoleto': ['obsoleto', 'artículo obsoleto', 'articulo obsoleto', 'descatalogado', 'discontinued'],
        'Proveedor': ['proveedor', 'nombre proveedor', 'nombreproveedor', 'prov', 'supplier', 'proveedor_nombre', 'desc_proveedor'],
        'Comprar_Stock': ['comprar_stock', 'comprar stock', 'comprar', 'se compra', 'activo compra', 'purchase']
    };

    // === PROVEEDORES columns ===
    const PROV_MAP = {
        'Código': ['código', 'codigo', 'cod', 'cod.proveedor', 'cod_proveedor', 'codprov', 'id', 'code'],
        'Nombre': ['nombre', 'nombre proveedor', 'nombreproveedor', 'razón social', 'razon social', 'name', 'supplier_name'],
        'Nombre Comercial': ['nombre comercial', 'nombrecomercial', 'nom_comercial', 'commercial_name', 'trade_name'],
        'DniCif': ['dnicif', 'dni/cif', 'cif', 'nif', 'dni', 'cif/nif', 'nif/cif', 'tax_id', 'cif_nif'],
        'Email': ['email', 'e-mail', 'correo', 'correo electrónico', 'correo electronico', 'mail'],
        'Telefono': ['telefono', 'teléfono', 'tel', 'tel.', 'phone', 'tel1', 'telefono1'],
        'Fax': ['fax', 'fax1', 'telefax'],
        'Dirección': ['dirección', 'direccion', 'dir', 'domicilio', 'address', 'calle'],
        'C.P.': ['c.p.', 'cp', 'código postal', 'codigo postal', 'cod.postal', 'codpostal', 'zip', 'postal'],
        'Poblacion': ['poblacion', 'población', 'ciudad', 'localidad', 'city', 'municipio'],
        'Provincia': ['provincia', 'state', 'region', 'comunidad'],
        'Fpago1': ['fpago1', 'fpago', 'f.pago', 'forma pago', 'forma de pago', 'formapago', 'payment'],
        'Vto1': ['vto1', 'vto', 'vencimiento', 'vencimiento1', 'plazo', 'plazo pago', 'due'],
        'IVA': ['iva', '%iva', 'tipo iva', 'iva%', 'tax', 'vat'],
        'Dto Com.': ['dto com.', 'dto com', 'dtocom', 'dto comercial', 'descuento comercial', 'dto.com.', 'dto_com', 'discount'],
        'Dto. P.P.': ['dto. p.p.', 'dto pp', 'dtopp', 'dto p.p.', 'dto_pp', 'pronto pago', 'early_payment'],
        'Margen Venta': ['margen venta', 'margenventa', 'margen_venta', 'margen', '%margen', 'margin']
    };

    /**
     * Given a row from the CSV/Excel, build a mapping of real column names
     * to canonical names. Returns a Map<realCol, canonicalCol>.
     */
    function buildMapping(row, mapType) {
        const map = mapType === 'stock' ? STOCK_MAP : PROV_MAP;
        const realCols = Object.keys(row);
        const result = {};
        const usedReal = new Set();

        for (const [canonical, aliases] of Object.entries(map)) {
            // Try exact match first
            for (const realCol of realCols) {
                if (usedReal.has(realCol)) continue;
                const realLower = realCol.toLowerCase().trim();
                // Exact match with canonical
                if (realLower === canonical.toLowerCase()) {
                    result[realCol] = canonical;
                    usedReal.add(realCol);
                    break;
                }
            }
            if (Object.values(result).includes(canonical)) continue;

            // Try alias matches
            for (const alias of aliases) {
                for (const realCol of realCols) {
                    if (usedReal.has(realCol)) continue;
                    const realLower = realCol.toLowerCase().trim()
                        .replace(/[_\-\.]/g, ' ')   // normalize separators
                        .replace(/\s+/g, ' ');       // collapse whitespace
                    if (realLower === alias || realLower.includes(alias) || alias.includes(realLower)) {
                        result[realCol] = canonical;
                        usedReal.add(realCol);
                        break;
                    }
                }
                if (Object.values(result).includes(canonical)) break;
            }
        }

        return result;
    }

    /**
     * Normalize an entire dataset: rename columns to canonical names.
     * Unknown columns are kept as-is.
     */
    function normalizeDataset(data, type) {
        if (!data || data.length === 0) return data;

        const mapping = buildMapping(data[0], type);
        const mappedCount = Object.keys(mapping).length;
        const totalCols = Object.keys(data[0]).length;

        console.log(`[ColumnResolver] Type: ${type}`);
        console.log(`[ColumnResolver] Mapped ${mappedCount}/${totalCols} columns`);
        console.log('[ColumnResolver] Mappings:', mapping);

        // List unmapped columns for debugging
        const unmapped = Object.keys(data[0]).filter(k => !mapping[k]);
        if (unmapped.length > 0) {
            console.log('[ColumnResolver] Unmapped columns:', unmapped.join(', '));
        }

        return data.map(row => {
            const newRow = {};
            for (const [realCol, value] of Object.entries(row)) {
                const canonical = mapping[realCol];
                if (canonical) {
                    newRow[canonical] = value;
                }
                // Always keep original too (with the original key if different)
                if (!canonical || canonical !== realCol) {
                    newRow[realCol] = value;
                }
            }
            return newRow;
        });
    }

    return { buildMapping, normalizeDataset, STOCK_MAP, PROV_MAP };
})();
