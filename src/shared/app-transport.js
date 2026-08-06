// Puente para compartir el transporte entre la cinta plana y la Moebius
let resolvePublished;
export const transportReady = new Promise((resolve) => {
  resolvePublished = resolve;
});

export function publishTransport(transport) {
  resolvePublished(transport);
}
