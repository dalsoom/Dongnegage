import { error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// [A. 'load' 함수 (페이지 '로딩'용)]
/** @type {import('./$types').PageServerLoad} */
export async function load({ params }) {
	const { couponID } = params; // (URL의 '1회용' 쿠폰 ID)

	// 'IssuedCoupons' 테이블을 'JOIN'해서 '진짜' 혜택 내용을 '전부' 가져옴
	const { data: coupon, error: couponError } = await supabaseAdmin
		.from('IssuedCoupons')
		.select(`
			id,
			status,
			expires_at, 
			CouponDeals (
				description,
				conditions,
				store_id,
				Stores ( storeName, mapUrl ) 
			)
		`)
		.eq('id', couponID)
		.single();
		
	if (couponError || !coupon) {
    throw error(404, `[쿠폰 조회 실패] 유효하지 않은 쿠폰입니다. (ID: ${couponID})`);
	}
	
  return {
      coupon: coupon // ⬅️ 재구성된 안전한 객체 리턴
  };
}

// [B. 'actions' 함수 (버튼 '클릭' 처리용)]
/** @type {import('./$types').Actions} */
export const actions = {
	// ('사장님 확인' 버튼이 'POST' 요청을 보내면 '이 함수'가 '실행'됨)
	default: async ({ params }) => {
		const { couponID } = params; // (이 '1회용' 쿠폰 ID)

		// 1. "IssuedCoupons" 테이블을 'UPDATE'합니다.
		const { data, error: updateError } = await supabaseAdmin
			.from('IssuedCoupons')
			.update({ 
				status: 'used', 		 // (⭐️ 사용 완료)
				used_at: new Date() 	 // (⭐️ 지금 시간)
			})
			.eq('id', couponID)
			.eq('status', 'unused') // (⭐️ '미사용' 쿠폰만 '수정')
			.select()
			.single(); // (1개만)

		if (updateError || !data) {
			// (에러가 나거나, '이미 사용된' 쿠폰을 '또' 누르면 '실패')
			return { success: false, message: `쿠폰 인증 실패: ${updateError?.message || '이미 사용됨'}` };
		}

		// 2. '성공' 메시지를 '얼굴'에 '반환'
		return { success: true };
	}
};
