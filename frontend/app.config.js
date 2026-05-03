require('dotenv').config();

export default ({ config }) => {
  const extra = config.extra || {};
  //const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || process.env.REACT_NATIVE_BACKEND_URL;
  const backendUrl = 'https://product-delivery-app.onrender.com';
  return {
    ...config,
    extra: {
      ...extra,
      backendUrl: backendUrl || 'http://127.0.0.1:8000',
    }
  };
};
