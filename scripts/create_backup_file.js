import fs from 'fs';
import path from 'path';

// Let's create the full user input
const csvHeader = `id,client_name,maps_link,target_count,reviewer_accounts,proof_link,status,created_at,store_name,notes,review_type,created_by,user_id`;
// We will write the maps and shopee content
console.log('Writing file...');
