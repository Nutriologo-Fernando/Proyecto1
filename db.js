const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuración de la conexión
const pool = mysql.createPool({
  host: process.env.DB_HOST_CARRITO,
  user: process.env.DB_USER_CARRITO,
  password: process.env.DB_PASSWORD_CARRITO,
  database: process.env.DB_NAME_CARRITO,
  waitForConnections: true,
  connectionLimit: 10, // Ajusta según sea necesario
  queueLimit: 0,
});

// Función para obtener la conexión a la base de datos
async function obtenerConexion() {
  return await pool.getConnection();
}

// Función para obtener los detalles de la orden por orderId
async function obtenerDetallesOrden(orderId) {
  const connection = await obtenerConexion();
  try {
    const [rows] = await connection.execute(
      'SELECT * FROM order_details WHERE order_id = ?',
      [orderId]
    );
    return rows;  // Retorna todos los detalles de la orden
  } catch (err) {
    console.error('Error al obtener los detalles de la orden:', err);
    throw err;
  } finally {
    connection.release();
  }
}

// Función para obtener los datos del cliente por orderId
async function obtenerClientePorOrderId(orderId) {
  const connection = await obtenerConexion();
  try {
    const [rows] = await connection.execute(
      'SELECT * FROM clientes WHERE order_id = ?',
      [orderId]
    );
    return rows[0];  // Retorna el primer cliente encontrado
  } catch (err) {
    console.error('Error al obtener el cliente por orderId:', err);
    throw err;
  } finally {
    connection.release();
  }
}

// Función para insertar una orden en la base de datos
async function guardarOrden(orderData) {
  const connection = await obtenerConexion();
  try {
    const [result] = await connection.execute(
      'INSERT INTO orders (order_id, total, cliente_nombre, cliente_email, cliente_direccion, status) VALUES (?, ?, ?, ?, ?, ?)',
      [
        orderData.order_id,
        orderData.total,
        orderData.cliente_nombre,
        orderData.cliente_email,
        orderData.cliente_direccion,
        orderData.status
      ]
    );
    return result;
  } catch (err) {
    console.error('Error al guardar la orden:', err);
    throw err;
  } finally {
    connection.release();
  }
}

// Función para insertar los detalles de la orden en la base de datos
async function guardarDetallesOrden(orderId, cart) {
  const connection = await obtenerConexion();
  try {
    for (const item of cart) {
      await connection.execute(
        'INSERT INTO order_details (order_id, product_name, quantity, price) VALUES (?, ?, ?, ?)',
        [orderId, item.name, item.quantity, item.price]
      );
    }
    return true;
  } catch (err) {
    console.error('Error al guardar los detalles de la orden:', err);
    throw err;
  } finally {
    connection.release();  // Asegúrate de liberar la conexión correctamente
  }
}

// Función para insertar los datos del cliente en la base de datos
async function guardarCliente(clienteData) {
  const connection = await obtenerConexion();
  try {
    const [result] = await connection.execute(
      'INSERT INTO clientes (order_id, nombre, email, telefono, direccion) VALUES (?, ?, ?, ?, ?)',
      [
        clienteData.order_id,
        clienteData.nombre,
        clienteData.email,
        clienteData.telefono,
        clienteData.direccion
      ]
    );
    return result;
  } catch (err) {
    console.error('Error al guardar los datos del cliente:', err);
    throw err;
  } finally {
    connection.release();
  }
}

// Función para actualizar el estado de la orden
async function actualizarEstadoOrden(orderId, estado) {
  const connection = await obtenerConexion();
  try {
    const [result] = await connection.execute(
      'UPDATE orders SET status = ? WHERE order_id = ?',
      [estado, orderId]
    );
    return result;
  } catch (err) {
    console.error('Error al actualizar la orden:', err);
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  obtenerConexion,
  pool, // por si usas directamente el pool después
  // exporta también las otras funciones como guardarOrden, etc.
  guardarOrden,
  guardarDetallesOrden,
  guardarCliente,
  actualizarEstadoOrden,
  obtenerClientePorOrderId,
  obtenerDetallesOrden
}






