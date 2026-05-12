import api from './api';

export type StaffRole = 3 | 4 | 5;

export interface StaffUser {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  role: StaffRole;
  roleName?: string;
  isActive: boolean;
  createdAt?: string;
  permissions: string[];
}

export interface CreateStaffPayload {
  name: string;
  phone: string;
  email?: string;
  password: string;
  role: StaffRole;
  permissions: string[];
}

export interface UpdateStaffPayload {
  name: string;
  email?: string;
  password?: string;
  role: StaffRole;
  permissions: string[];
}

const staffApi = {
  async getStaff(): Promise<StaffUser[]> {
    const response = await api.get('/staff');
    return response.data?.data || response.data || [];
  },

  async createStaff(payload: CreateStaffPayload) {
    const response = await api.post('/staff', payload);
    return response.data;
  },

  async updateStaff(id: number, payload: UpdateStaffPayload) {
    const response = await api.put(`/staff/${id}`, payload);
    return response.data;
  },

  async updateStaffStatus(id: number, isActive: boolean) {
    const response = await api.put(`/staff/${id}/status`, { isActive });
    return response.data;
  },

  async deleteStaff(id: number) {
    const response = await api.delete(`/staff/${id}`);
    return response.data;
  },
};

export default staffApi;