let io = null;

export function setSocketIO(ioInstance) {
  io = ioInstance;
}

export function getSocketIO() {
  return io;
}
