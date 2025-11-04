import { error, json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
// ⚠️ 환경 변수는 실제 환경에 맞게 로드되어야 합니다. (SvelteKit 기본 방식 사용)
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'; 
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);


// 이 함수는 /generate 경로로 들어오는 POST 요청을 처리합니다.
/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) { 
    
    // 1. 클라이언트(Svelte form)에서 보낸 폼 데이터 파싱
    const formData = await request.formData();
    const dealIdParam = formData.get('dealId');         // 선택된 쿠폰 ID (e.g., "17")
    const originId = formData.get('originId');           // 가게의 UUID
    const expiryDaysParam = formData.get('expiryDays'); // 만료일 (e.g., "7")

    // 2. 데이터 유효성 검사 및 숫자로 변환
    if (!dealIdParam || !originId || !expiryDaysParam) {
        // 필수 정보 누락 시 400 에러 반환
        throw error(400, "필수 쿠폰 정보가 누락되었습니다.");
    }
    
    const dealId = parseInt(dealIdParam, 10);
    const expiryDays = parseInt(expiryDaysParam, 10);
    
    if (isNaN(dealId) || isNaN(expiryDays)) {
        throw error(400, "쿠폰 ID 또는 만료일이 유효한 숫자가 아닙니다.");
    }

    // 3. 쿠폰 만료일 계산
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + expiryDays); // 오늘 날짜 + 만료일(일) 계산

    // 4. IssuedCoupons 테이블에 삽입할 객체 준비 (단일 쿠폰)
    const couponToInsert = {
        deal_id: dealId,
        origin_store_id: originId,
        status: 'unused',
        expires_at: expirationDate.toISOString()
    };

    // 5. IssuedCoupons 테이블에 삽입 실행
    const { data: newCoupon, error: insertError } = await supabaseAdmin
        .from('IssuedCoupons')
        .insert(couponToInsert)
        .select('id') // 새로 발급된 쿠폰의 고유 UUID만 가져옵니다.
        .single(); // 단 하나의 레코드만 가져옵니다.

    if (insertError || !newCoupon || !newCoupon.id) {
        console.error("Single Insert Failed:", insertError?.message);
        // DB 삽입 실패 시 500 에러 반환
        throw error(500, `[쿠폰 생성 실패] DB에 쿠폰을 발급하지 못했습니다: ${insertError?.message || '발급된 ID 누락'}`);
    }
    
    // 6. 성공: 발급된 새 UUID를 JSON 응답으로 클라이언트에게 반환
    // 이 issuedId를 +page.svelte가 받아 화면 전환에 사용합니다.
    return json({ 
        success: true, 
        issuedId: newCoupon.id, 
        message: '쿠폰이 성공적으로 발급되었습니다.'
    }); 
}

// ⭐️⭐️ 임시 추가: GET 요청이 들어왔을 때 405 에러를 피하도록 처리 ⭐️⭐️
export async function GET() {
    // 폼 클릭이 잘못 POST가 아닌 GET으로 전송되었을 경우 405 에러 대신
    // 400 Bad Request 에러를 던져 클라이언트에게 알리거나, 빈 응답을 줍니다.
    throw error(400, "잘못된 접근입니다. 쿠폰 발급은 POST 폼 요청으로만 가능합니다.");
}