require('dotenv').config();
const express = require('express');
const paypal = require('@paypal/checkout-server-sdk');
const cors = require('cors');
const mysql = require('mysql2/promise');
const { enviarCorreoConfirmacion } = require('./mailer');
const db = require('./db'); // usa este para queries personalizados

const app = express();
const port = process.env.PORT || 8080;

// Configuración PayPal
const environment = new paypal.core.LiveEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET);
const client = new paypal.core.PayPalHttpClient(environment);

// Middleware
app.use(cors({
    origin: ['https://forestgreen-jellyfish-805408.hostingersite.com', 'https://www.paypal.com', 'https://carro-3.onrender.com'],
    methods: ['GET', 'POST'],
    credentials: true
}));
app.use(express.json());

// Configuración de conexión DB
const dbConfig = {
    host: process.env.DB_HOST_LOGIN,
    user: process.env.DB_USER_LOGIN,
    password: process.env.DB_PASSWORD_LOGIN,
    database: process.env.DB_NAME_LOGIN
};

async function connectDB() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        console.log("Conectado a la base de datos correctamente");
        return connection;
    } catch (error) {
        console.error("Error de conexión:", error);
        throw error;
    }
}
connectDB();

// Productos disponibles
const productDatabase = [
    { id: 1, name: "Consulta Nutricional Clinica", price: 20.00 },
    { id: 2, name: "Consulta Nutricional Deportiva", price: 20.00 },
    { id: 3, name: "Consulta On-Line", price: 20.00 },
];

// -------------------- LOGIN --------------------
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [results] = await connection.execute('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);
        await connection.end();
        if (results.length > 0) {
            const user = results[0];
            user.folio = user.id;
            res.json({ success: true, user });
        } else {
            res.json({ success: false, message: 'Correo o contraseña incorrectos' });
        }
    } catch (err) {
        console.error('Error en login:', err);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

// -------------------- MEDICIONES --------------------
app.get('/mediciones/:folio', async (req, res) => {
    const { folio } = req.params;
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [results] = await connection.execute('SELECT * FROM mediciones WHERE folio = ?', [folio]);
        await connection.end();
        res.json({ success: results.length > 0, data: results });
    } catch (err) {
        console.error('Error en mediciones:', err);
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
});

app.get('/signos_vitales/:folio', async (req, res) => {
    const { folio } = req.params;
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [results] = await connection.execute('SELECT * FROM signos_vitales WHERE folio = ?', [folio]);
        await connection.end();
        res.json({ success: results.length > 0, data: results });
    } catch (err) {
        console.error('Error en signos vitales:', err);
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
});

app.get('/bioquimicos/:folio', async (req, res) => {
    const { folio } = req.params;
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [results] = await connection.execute('SELECT * FROM bioquimicos WHERE folio = ?', [folio]);
        await connection.end();
        res.json({ success: results.length > 0, data: results });
    } catch (err) {
        console.error('Error en bioquímicos:', err);
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
});

app.get('/plan_nutricional/:folio', async (req, res) => {
    const { folio } = req.params;
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [results] = await connection.execute('SELECT * FROM plan_nutricional WHERE folio = ?', [folio]);
        await connection.end();
        res.json({ success: results.length > 0, data: results });
    } catch (err) {
        console.error('Error en plan_nutricional:', err);
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
});

// -------------------- PAYPAL ORDEN --------------------
app.post('/api/orders', async (req, res) => {
    console.log("🛒 Nueva orden recibida:", req.body);
    const { cart, cliente } = req.body;

    if (!cart || cart.length === 0) return res.status(400).json({ error: "El carrito está vacío" });
    if (!cliente || !cliente.nombre || !cliente.email || !cliente.calle || !cliente.numero || !cliente.colonia || !cliente.ciudad || !cliente.codigo) {
        return res.status(400).json({ error: "Datos del cliente incompletos" });
    }

    console.log("📦 Datos del Cliente:", cliente);
    let totalBackend = 0;

    for (const item of cart) {
        const product = productDatabase.find(p => p.id === item.id);
        if (!product) return res.status(400).json({ error: `Producto no encontrado: ${item.name}` });
        if (Number(item.price) !== product.price) {
            return res.status(400).json({ error: `Precio inválido para ${item.name}. Esperado: ${product.price}, Recibido: ${item.price}` });
        }
        totalBackend += product.price * item.quantity;
    }

    totalBackend = totalBackend.toFixed(2);

    const request = new paypal.orders.OrdersCreateRequest();
    request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [{
            amount: {
                currency_code: 'MXN',
                value: totalBackend,
                breakdown: {
                    item_total: { currency_code: 'MXN', value: totalBackend }
                },
            },
            items: cart.map(item => ({
                name: item.name,
                unit_amount: { currency_code: 'MXN', value: Number(item.price).toFixed(2) },
                quantity: item.quantity.toString(),
            }))
        }]
    });

    try {
        const order = await client.execute(request);
        console.log("✅ Orden creada con éxito:", order.result.id);

        const orderId = order.result.id;
        const orderData = {
            order_id: orderId,
            total: totalBackend,
            cliente_nombre: cliente.nombre,
            cliente_email: cliente.email,
            cliente_direccion: `${cliente.calle} ${cliente.numero}, ${cliente.colonia}, ${cliente.ciudad}, ${cliente.codigo}`,
            status: 'CREATED'
        };

        const result = await db.guardarOrden(orderData);
        console.log("✅ Orden guardada en la base de datos:", result);

        await db.guardarDetallesOrden(orderId, cart);
        console.log("✅ Detalles de la orden guardados correctamente.");

        const clienteData = {
            order_id: orderId,
            nombre: cliente.nombre,
            email: cliente.email,
            telefono: cliente.telefono,
            direccion: `${cliente.calle} ${cliente.numero}, ${cliente.colonia}, ${cliente.ciudad}, ${cliente.codigo}`
        };
        await db.guardarCliente(clienteData);
        console.log("✅ Datos del cliente guardados correctamente.");

        res.status(200).json({ id: orderId });
    } catch (err) {
        console.error("❌ Error al crear la orden:", err);
        res.status(500).json({ error: "Error al crear la orden", details: err.message });
    }
});

app.post('/api/orders/:orderId/capture', async (req, res) => {
    const { orderId } = req.params;
    console.log("🔍 Capturando pago para Order ID:", orderId);
    try {
        const orderDetails = await client.execute(new paypal.orders.OrdersGetRequest(orderId));
        if (orderDetails.result.status === 'COMPLETED') {
            console.log("✅ Pago ya fue capturado previamente:", orderDetails.result);
            return res.status(200).json({ message: "Pago ya fue capturado previamente", result: orderDetails.result });
        }

        const request = new paypal.orders.OrdersCaptureRequest(orderId);
        const capture = await client.execute(request);
        console.log("✅ Pago confirmado:", capture.result);

        const result = await db.actualizarEstadoOrden(orderId, 'COMPLETED');
        console.log("✅ Orden actualizada en la base de datos:", result);

        const cliente = await db.obtenerClientePorOrderId(orderId);
        const cart = await db.obtenerDetallesOrden(orderId);

        await enviarCorreoConfirmacion(cliente, orderId, cart);
        console.log("📧 Correo de confirmación enviado a:", cliente.email);

        res.status(200).json(capture.result);
    } catch (err) {
        console.error("❌ Error al capturar la orden:", err);
        res.status(500).json({ error: "Error al capturar la orden", details: err.message });
    }
});

// 🚀 Iniciar servidor
app.listen(port, () => {
    console.log(`🚀 Servidor en ejecución en http://localhost:${port} eres la mera pistola`);
});





