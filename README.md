# Sugestión • Sistema Digital de Control de Stock y Materia Prima

Sistema de relevamiento de stock físico de materias primas y packaging con cálculo dinámico mensual de mínimos y máximos estacionales, órdenes de compra automáticas y portal optimizado para tablets en depósito.

---

## 🚀 Cómo ejecutarlo en tu computadora (Local)

Si clonaste este repositorio desde GitHub en tu computadora:

1. **Abrir la terminal** en la carpeta del proyecto.
2. **Instalar dependencias**:
   ```bash
   npm install
   ```
3. **Iniciar el servidor de desarrollo**:
   ```bash
   npm run dev
   ```
4. **Abrir en tu navegador**:
   - Acceso Administrador: [http://localhost:3000](http://localhost:3000)
   - Acceso Operador (Tablet): [http://localhost:3000#operador](http://localhost:3000#operador)

---

## 🌐 Cómo publicarlo gratis en internet (Para acceder desde cualquier celular o tablet)

GitHub por defecto almacena el código fuente, no ejecuta aplicaciones web directamente a menos que configures un despliegue:

### Opción 1: Vercel (Recomendada - 1 minuto y gratis)
1. Entra a [vercel.com](https://vercel.com) e inicia sesión con tu cuenta de GitHub.
2. Haz clic en **"Add New Project"** e importa este repositorio.
3. Deja la configuración por defecto y haz clic en **"Deploy"**.
4. ¡Listo! Vercel te dará un enlace público HTTPS (ej: `https://tu-proyecto.vercel.app`) para usar en cualquier tablet o PC.

### Opción 2: GitHub Pages (Directo desde GitHub)
1. En tu repositorio de GitHub, ve a **Settings** > **Pages** (en el menú lateral izquierdo).
2. En **Build and deployment** > **Source**, selecciona **"GitHub Actions"**.
3. El archivo `.github/workflows/deploy.yml` ya incluido compilará y publicará la aplicación automáticamente.

---

## 📱 Accesos y Roles
- **Portal Operador (Tablet)**: registra el stock por bultos o unidades. No puede modificar compras ni parámetros.
- **Portal Administrador**: tablero, estado crítico, reposición y mínimos/máximos mensuales. Requiere PIN.

## 🔗 Conexión con Google Sheets (obligatoria para compartir datos entre tablets)
1. En la app: **Acceso Admin** > pestaña **Google Sheets** > **Copiar Código Apps Script** (es el archivo `apps-script/Code.gs`).
2. En tu Google Sheet: **Extensiones > Apps Script**, pega el código y guarda.
3. **Configuración del proyecto > Propiedades del script**, agrega:
   - `ACCESS_TOKEN`: una clave larga y aleatoria.
   - `ADMIN_PIN`: el PIN de administrador.
4. **Implementar > Nueva implementación > Aplicación web** (Ejecutar como: Yo, Acceso: Cualquier usuario). Copia la URL `/exec`.
5. En **cada tablet**: pestaña Google Sheets > pega URL y token > **Guardar y probar conexión**.
6. La primera vez, desde una tablet con los datos correctos, pulsa **Enviar stock ahora** para cargar la planilla completa.

Cómo funciona:
- Cada cambio se envía a la planilla a los ~1,2 s. Si no hay conexión queda pendiente y se reenvía al volver.
- Cada tablet descarga la planilla al abrir, cada minuto y al volver a la pantalla. Por ítem gana la carga más reciente; un ítem con cambios sin enviar no se pisa.
- El Apps Script rechaza todo pedido sin `ACCESS_TOKEN`, y los cambios de mínimos/máximos sin `ADMIN_PIN`.

### Seguridad: qué protege y qué no
- La URL del script ya no está en el código. Sin el token no se puede leer ni escribir la planilla.
- Con la planilla configurada, el PIN de admin lo valida el Apps Script. El PIN embebido (`VITE_ADMIN_PIN`, por defecto `1458`) solo sirve para la configuración inicial, antes de conectar la tablet.
- El token queda guardado en cada tablet: quien tenga acceso físico a una tablet configurada puede cargar stock (es el uso esperado), pero no cambiar mínimos/máximos sin el PIN.
- La marca "más reciente" usa el reloj de cada tablet: mantenelas con fecha y hora automáticas.

## 🧪 Tests
```bash
npm test
```
Incluye la lógica de stock, la sincronización y el Apps Script (ejecutado contra una planilla simulada).
