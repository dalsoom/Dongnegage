// [파일명: src/routes/shop/[id]/+page.server.js] (⭐️ '최종' 1단계 ⭐️)

import { error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/** @type {import('./$types').PageServerLoad} */
export async function load({ params }) {
  const { id } = params; // (1. 'B 카페'의 uuid)
  const supabase = supabaseAdmin;

  // 1. 'B 카페'의 '이름'을 'Stores'에서 찾습니다.
  const { data: storeData, error: storeError } = await supabase
    .from('Stores')
    .select('storeName')
    .eq('id', id)
    .single();

  if (storeError) {
    throw error(404, `[1단계 에러] 가게 정보 조회 실패 (ID: ${id}) - ${storeError.message}`);
  }
  const { storeName } = storeData;

 // -------------------------------------------------
  // [2단계 + 3단계: '제휴된' '상대방 ID' (A 네일샵) 찾기]
  // (⭐️ '양방향'으로 '수리'된 '최종' 코드 ⭐️)
  // -------------------------------------------------
  const { data: affiliateIds, error: affiliateError } = await supabase
    .from('Affiliations')
    .select('store_a_id, store_b_id')
    // (⭐️ 'A'가 '나'이거나, 'B'가 '나'인 '모든' 경우를 'OR'로 '검색' ⭐️)
    .or(`store_a_id.eq.${id},store_b_id.eq.${id}`); 

  if (affiliateError) {
    throw error(500, `[2단계 에러] 제휴 목록(Affiliations) 조회 실패 - ${affiliateError.message}`);
  }
  
  if (!affiliateIds || affiliateIds.length === 0) {
    return { storeName, deals: [] };
  }

  // 3. 'ID 목록'을 '정리'합니다. (내 ID('id')는 빼고, '상대방' ID만)
  const partnerIds = affiliateIds.map(aff => 
    aff.store_a_id === id ? aff.store_b_id : aff.store_a_id
  );

  // -------------------------------------------------
  // [4단계 + 5단계 + 6단계: '상대방 ID'로 '쿠폰딜'과 '상대방 이름' 찾기]
  // -------------------------------------------------
  const { data: deals, error: dealError } = await supabase
    .from('CouponDeals') 
    .select(`
      id,
      description,
      conditions,
      store_id,
      Stores ( storeName, mapUrl )
    `) 
    .in('store_id', partnerIds) // (⭐️ '상대방' ID 목록과 '일치'하는 '모든' 딜)
    .order('id');

  if (dealError) {
    throw error(500, `[3단계 에러] 쿠폰 딜(CouponDeals) 조회 실패 - ${dealError.message}`);
  }

  if (deals && deals.length > 0) {
  // 2. JS에서 랜덤으로 3개를 선택하는 로직을 적용합니다.
      const FIXED_EXPIRY_DAYS = 7; // ⭐️ 만료 기간을 7일로 고정 ⭐️
      const shuffledDeals = deals.sort(() => 0.5 - Math.random());
      const finalDeals = shuffledDeals.slice(0, 3).map(deal => {
        return {
          ...deal,
          expiryDays: FIXED_EXPIRY_DAYS,
          mapUrl: deal.Stores.mapUrl
        };
      });
      return {
        originStoreId: id,
        storeName: storeName,
        deals: finalDeals
      };
      
  }
  
  // 7. '얼굴(+page.svelte)'에 '최종' 데이터 '반환'
  return {
    originStoreId: id,
    storeName: storeName,
    deals: []
  };
}