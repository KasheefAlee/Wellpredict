import Cookies from 'js-cookie';

export const setAuthToken = (token) => {
  Cookies.set('token', token, { expires: 7 }); // 7 days
};

export const getAuthToken = () => {
  return Cookies.get('token');
};

export const removeAuthToken = () => {
  Cookies.remove('token');
};

export const isAuthenticated = () => {
  return !!getAuthToken();
};

