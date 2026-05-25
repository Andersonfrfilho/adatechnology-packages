import { HttpProviderInterface } from "../../http.interface";

export interface AxiosHttpProviderInterface extends HttpProviderInterface {}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}
