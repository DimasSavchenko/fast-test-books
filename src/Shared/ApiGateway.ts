import { API_BASE } from "./config";

export interface HttpGateway {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, payload: unknown): Promise<T>;
}

export default class ApiGateway implements HttpGateway {
  get = async <T>(path: string): Promise<T> => {
    const response = await fetch(`${API_BASE}${path}`);
    return this.toDto<T>(response);
  };

  post = async <T>(path: string, payload: unknown): Promise<T> => {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return this.toDto<T>(response);
  };

  private toDto = async <T>(response: Response): Promise<T> => {
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return (await response.json()) as T;
  };
}
