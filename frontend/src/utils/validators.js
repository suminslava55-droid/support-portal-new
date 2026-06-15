export const validatePassword = (_, value) => {
  if (!value) return Promise.resolve();
  if (value.length < 8) return Promise.reject('Минимум 8 символов');
  if (!/[A-Z]/.test(value)) return Promise.reject('Нужна хотя бы одна заглавная буква');
  if (!/[0-9]/.test(value)) return Promise.reject('Нужна хотя бы одна цифра');
  return Promise.resolve();
};
