// Never expose raw exceptions: fetch/SQLite/S3 messages can contain credentials or paths.
export function syncFailure(error, stage) {
  const status = Number(error?.status);
  const code = error?.cause?.code ?? error?.code;
  let message = 'La operación falló. Se reintentará en el siguiente ciclo.';
  if (status === 401 || status === 403) message = 'Acceso rechazado. Comprueba el secreto de intercambio, el nodo y los permisos del servicio.';
  else if (status === 404) message = 'No se encontró el servicio o la base. Comprueba las URL y que ambas instalaciones estén actualizadas.';
  else if (status === 409) message = 'Otro proceso modificó el estado. Se reintentará sin sobrescribirlo.';
  else if (status >= 500) message = 'El servidor remoto no pudo completar la operación. Revisa sus servicios y configuración.';
  else if (['ENOTFOUND', 'EAI_AGAIN'].includes(code)) message = 'No se puede resolver el nombre del servidor. Comprueba NetBird y el DNS dentro del contenedor.';
  else if (code === 'ECONNREFUSED') message = 'El servidor rechaza la conexión. Comprueba el puerto y que el servicio esté iniciado.';
  else if (['ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT'].includes(code) || ['TimeoutError', 'AbortError'].includes(error?.name)) message = 'Se agotó el tiempo de espera. Comprueba NetBird y la conexión con el servidor.';
  else if (stage === 'accounts') message = 'No se pudieron aplicar las cuentas. Comprueba el administrador con contraseña, el esquema SQLite y posibles colisiones de correos.';
  return { stage, message, ...(status ? { status } : {}), updatedAt: new Date().toISOString() };
}
