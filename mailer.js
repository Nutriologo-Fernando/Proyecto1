const nodemailer = require('nodemailer');

// Configurar transporte
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Tu correo Gmail
    pass: process.env.EMAIL_PASS  // Tu contraseña de aplicación
  }
});

// Función para enviar correo de confirmación
async function enviarCorreoConfirmacion(cliente, orderId, cart) {
  // Depuración de los datos del cliente y el carrito
  console.log('Datos del cliente recibido en la función:', cliente);
  console.log('Datos del carrito recibido en la función:', cart);

  // Dividir la dirección del cliente en partes
  const [calle, numero, colonia, ciudad, codigo] = cliente.direccion.split(',');

  // Verifica que el cliente y el carrito no estén vacíos
if (!cliente || !cliente.nombre || !cliente.email || !cliente.calle || !cliente.numero || !cliente.colonia || !cliente.ciudad || !cliente.codigo) {
    console.error('Error: Faltan datos en el cliente:', cliente);
}

  if (!Array.isArray(cart) || cart.length === 0) {
    console.error('Error: El carrito está vacío o no es un arreglo válido:', cart);
  }

  const total = cart.reduce((acc, item) => {
    if (!item.price || !item.quantity) {
      console.error('Error en los detalles del producto. Asegúrate de que cada item tenga precio y cantidad:', item);
      return acc; // No acumula si falta algún valor
    }
    return acc + (parseFloat(item.price) * item.quantity); // Asegúrate de que el precio sea un número
  }, 0);

  // Construir la lista de productos
  const productosHTML = cart.map(item => `
    <li>${item.product_name} - ${item.quantity} x $${item.price}</li>
  `).join('');

  // Verificación del total
  console.log('Total calculado:', total);

  // Configuración del correo
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: cliente.email,
    subject: 'Confirmación de Compra - Pedido #' + orderId,
    html: `
      <h1>Gracias por tu compra, ${cliente.nombre}!</h1>
      <p>Tu pedido ha sido recibido con éxito. Aquí están los detalles:</p>
      <ul>${productosHTML}</ul>
      <p><strong>Total: $${total.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}</strong></p>
      <p>Dirección de envío: ${calle} ${numero} ${colonia}, ${ciudad}</p>
      <p>¡Esperamos verte de nuevo pronto!</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Correo de confirmación enviado a:', cliente.email);
  } catch (error) {
    console.error('❌ Error al enviar correo de confirmación:', error);
  }
}

module.exports = { enviarCorreoConfirmacion };


