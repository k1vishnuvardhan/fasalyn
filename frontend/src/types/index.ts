export type UserRole = 'FARMER' | 'OFFICER' | 'EXPERT' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  environment: 'production' | 'demo';
}

export type GrowthStage = 'seedling' | 'vegetative' | 'flowering' | 'fruiting' | 'harvest';

export interface Farm {
  id: string;
  farmerId: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  polygon: any | null; // GeoJSON Polygon
  areaSquareMeters: number | null;
  areaUnit: string;
  crop: string | null;
  variety: string | null;
  plantingDate: string | null;
  growthStage: GrowthStage | null;
  monitoringMode: 'QUICK_DETECTION' | 'SPATIAL';
  createdAt: string;
  updatedAt: string;
}

export interface Plot {
  id: string;
  farmId: string;
  name: string;
  crop: string;
  cropStage: GrowthStage | null;
  polygon: any | null; // GeoJSON Polygon
  areaSquareMeters: number | null;
  areaUnit: string;
  variety: string | null;
  plantingDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ScanStatus = 'PROCESSING' | 'COMPLETED' | 'MODEL_UNAVAILABLE';

export interface Scan {
  id: string;
  plot_id: string;
  user_id: string;
  image_key: string;
  mime_type: string;
  status: ScanStatus;
  model_id: string | null;
  result_json: string | null;
  created_at: string;
}

export interface RiskAssessment {
  id: string;
  plot_id: string;
  scan_id: string | null;
  score: number;
  level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  factors_json: string;
  forecast_json: string;
  created_at: string;
}

export interface TrapObservation {
  id: string;
  plot_id: string;
  user_id: string;
  trap_type: string;
  pest: string;
  count: number;
  observed_at: string;
  created_at: string;
}

export interface OfficerCase {
  id: string;
  scan_id: string;
  status: 'OFFICER_REVIEW' | 'EXPERT_REVIEW' | 'OFFICER_CONFIRMED' | 'EXPERT_CONFIRMED' | 'REJECTED';
  severity: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  
  // Extended fields joined in query
  result_json?: string;
  plot_name?: string;
  crop?: string;
  farm_name?: string;
}
