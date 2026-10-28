// Ponto único de acesso a dados. Com VITE_API_URL definida usa a API;
// sem ela, o mock em localStorage. O resto do app não sabe a diferença.
import { apiRepository } from "./apiRepository";
import { mockRepository } from "./mockRepository";

export const HAS_API = Boolean(import.meta.env.VITE_API_URL);
export const repository = HAS_API ? apiRepository : mockRepository;
