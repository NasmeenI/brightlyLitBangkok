import { jwtDecode } from "jwt-decode";

export const handler = async (event: any) => {
  const token = event.headers.Authorization.split(' ')[1];
  const decoded = jwtDecode(token);
  const username = decoded['cognito:username'];
  return {
      statusCode: 200,
      body: username
  };
};