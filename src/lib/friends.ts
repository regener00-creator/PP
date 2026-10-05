export type MentionFriend = { id: string; line_user_id: string; display_name: string; group_id: string; blocked: boolean };
export type MentionOwner = { display_name: string; line_user_id: string | null };

export function friendName(friend: MentionFriend, owner: MentionOwner) {
  const name = friend.display_name.trim();
  if (friend.line_user_id === owner.line_user_id) return `${name || owner.display_name || "เจ้าของ"} (ฉัน)`;
  return name || `ยังไม่มีชื่อ (ลงท้าย ${friend.line_user_id.slice(-4)})`;
}
