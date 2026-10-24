/** 产品库：每个用户可有多个 */
export type Library = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

/** 规格参数：动态 key-value 列表 */
export type SpecItem = { key: string; value: string };

/** 文档附件：名称 + Storage 路径 */
export type DocItem = { name: string; path: string };

export type Product = {
  id: string;
  user_id: string;
  library_id: string | null;
  name: string;
  model: string;
  category: string;
  specs: SpecItem[];
  price: number | null;
  notes: string;
  images: string[]; // Storage 路径（product-images bucket）
  docs: DocItem[]; // Storage 路径（product-docs bucket）
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  email: string | null;
  username: string | null;
  display_name: string;
  avatar_path: string;
  header_display: string;
  is_admin: boolean;
  invite_code_id: string | null;
  created_at: string;
  invite_codes?: { source_label: string } | null;
};

export type InviteCode = {
  id: string;
  code: string;
  source_label: string;
  created_by: string | null;
  created_at: string;
  max_uses: number;
  used_count: number;
  is_active: boolean;
};

export type LibraryShare = {
  id: string;
  library_id: string;
  user_id: string;
  token: string;
  created_at: string;
};

/** 导入时解析出的一行数据 */
export type ImportRow = {
  name: string;
  model: string;
  category: string;
  price: number | null;
  specs: SpecItem[];
  notes: string;
};
