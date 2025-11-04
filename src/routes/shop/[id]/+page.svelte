<script>
    // ❌ import { enhance } from '$app/forms'; 제거 (사용 안 함)
    
	/** @type {import('./$types').PageData} */
	export let data;
	/** @type {import('./$types').ActionData} */
	
    // ⭐️ 상태 관리 변수: 현재 발급이 완료된 쿠폰 ID ⭐️
    let issuedCouponId = null; 
    let issuedDealData = null;
    let isSubmitting = false; // 버튼 로딩 상태 관리를 위해 추가

    // ⭐️ SvelteKit 폼 대신 일반 fetch API로 POST 요청을 처리합니다. ⭐️
    async function handlePost(event) {
        event.preventDefault(); // 브라우저의 기본 폼 제출(GET으로 이어질 수 있음)을 막습니다.

        isSubmitting = true;

        // 폼 데이터를 FormData 객체로 만듭니다.
        const formData = new FormData(event.target);
        
        try {
            // fetch API를 사용해 POST 요청을 명시적으로 보냅니다.
            const response = await fetch('/generate', {
                method: 'POST',
                body: formData, // FormData 객체를 body에 넣으면 Content-Type이 자동으로 multipart/form-data로 설정됨
            });
            
            const result = await response.json(); // 서버에서 보낸 JSON 응답을 받습니다.

            if (response.ok && result.success && result.issuedId) {
                // 서버로부터 발급된 단일 IssuedCoupon ID를 받습니다.
                issuedCouponId = result.issuedId; 
                
                // 폼이 전송될 때 사용된 dealId를 찾아 해당 쿠폰 데이터를 추출합니다.
                const sentDealId = parseInt(formData.get('dealId'), 10);
                const foundDeal = data.deals.find(d => d.id === sentDealId);
                
                if (foundDeal) {
                     // 발급 완료 화면에 보여줄 데이터 준비
                     issuedDealData = {
                        ...foundDeal,
                        issuedId: issuedCouponId // 발급된 쿠폰의 UUID 추가
                     };
                }

            } else {
                // API에서 에러가 반환된 경우 처리
                const errorMessage = result.message || '쿠폰 발급에 실패했습니다.';
                alert(`⚠️ 오류 발생: ${errorMessage}`);
            }

        } catch (error) {
            console.error('Fetch error:', error);
            alert('⚠️ 네트워크 또는 서버 요청 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            isSubmitting = false;
        }
    }

    async function shareCouponUrl(id, storeName, description) {
        if (!id) {
            alert('⚠️ 쿠폰 ID가 발급되지 않아 공유할 수 없습니다.');
            return; // ID가 없으면 함수 실행 중단
        }
        
        // window.location.origin은 현재 실행되는 서버의 주소(예: http://localhost:5173)
        const shareUrl = `${window.location.origin}/coupon/${id}`; 
        
        if (navigator.share) {
            // 1. 네이티브 공유 API 사용 (카톡, 메시지 등)
            try {
                await navigator.share({
                    title: `[${storeName}] 혜택 발급 완료`,
                    text: `${description} 혜택이 발급되었습니다! 아래 링크에서 확인하세요.`, 
                    url: shareUrl 
                });
            } catch (err) {
                console.error('공유 실패:', err);
            }
        } else {
            // 2. 네이티브 API가 없을 경우: 클립보드 복사
            navigator.clipboard.writeText(shareUrl).then(() => {
                alert('쿠폰 주소가 클립보드에 복사되었습니다. (카톡 등에 붙여넣으세요)');
            }).catch(err => {
                alert('클립보드 복사에 실패했습니다. 수동으로 복사해 주세요.');
            });
        }
    }

</script>

<div class="shop-container">
    <header class="header">
        <h1>{data.storeName}</h1>
        <p>제휴 동네 가게 혜택</p>
    </header>
    
    <!-- ⭐️⭐️⭐️ 조건부 렌더링: 발급 전(목록) vs. 발급 후(상세) ⭐️⭐️⭐️ -->
    {#if issuedDealData}
        <!-- 발급 후: 발급 완료된 단일 쿠폰 상세 정보를 보여줍니다. (새로고침 없음) -->
        <div class="issued-detail-card">
            <h2 class="issued-title">🎉 쿠폰 발급 완료!</h2>
            <p class="issued-message">{issuedDealData.Stores.storeName} 혜택이 저장되었습니다.</p>
            
            <!-- 1. 쿠폰 상세 정보 -->
            <div class="coupon-body-issued">
                <p class="description-text-issued">{issuedDealData.description}</p>
                <p class="conditions-text-issued">{issuedDealData.conditions}</p>
                <p class="expiry-time-issued">
                    ⏰ 발급일로부터 <span class="days">{issuedDealData.expiryDays}일</span> 간 유효합니다.
                </p>
            </div>
            
            <!-- 2. 지도 및 저장 버튼 -->
            {#if issuedDealData.mapUrl}
				<a href={issuedDealData.mapUrl} target="_blank" class="map-button-issued">
					📍 가게 위치 지도 보기 (네이버 지도)
				</a>
			{/if}
            
            <button 
                on:click={() => shareCouponUrl(issuedCouponId, issuedDealData.Stores.storeName, issuedDealData.description)}
                class="share-button-issued"
            >
                ✅ 쿠폰 저장하고 카톡/문자에 공유하기
            </button>
            
            <!-- 목록으로 돌아가기 버튼 -->
            <button on:click={() => issuedDealData = null} class="back-button">
                다른 쿠폰 보러가기
            </button>
        </div>

    {:else}
        <!-- 발급 전: 쿠폰 목록을 보여줍니다. -->
        <div class="deals-list">
            {#each data.deals as deal}
                <div class="deal-card">
                    <h2 class="partner-name">{deal.Stores.storeName}</h2>
                    <p class="description">{deal.description}</p>
                    <p class="conditions">{deal.conditions ? deal.conditions : '별도 사용 조건 없음'}</p>
                    <p class="expiry-info">
                        ⏰ 쿠폰 발급일로부터 <span class="days">{deal.expiryDays}일</span> 이내 사용해야 합니다.
                    </p>
                    
                    <!-- ⭐️⭐️ use:enhance 대신 on:submit={handlePost}를 사용합니다. ⭐️⭐️ -->
                    <form on:submit={handlePost} method="POST"> 
                        <input type="hidden" name="dealId" value={deal.id} />
                        <input type="hidden" name="originId" value={data.originStoreId} />
                        <input type="hidden" name="expiryDays" value={deal.expiryDays} />
                        
                        <button type="submit" class="get-coupon-button" disabled={isSubmitting}>
                            {#if isSubmitting}
                                쿠폰 발급 중...
                            {:else}
                                쿠폰 받기
                            {/if}
                        </button>
                    </form>
                </div>
            {/each}
            
            {#if data.deals.length === 0}
                <p class="no-deals">현재 이 가게와 제휴된 쿠폰 혜택이 없습니다.</p>
            {/if}
        </div>
    {/if}
</div>


<style>
    /* ... (CSS는 기존과 동일하게 유지됩니다.) ... */
    .shop-container {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
        font-family: 'Inter', sans-serif;
    }
    .header {
        text-align: center;
        margin-bottom: 30px;
        padding: 20px;
        background-color: #f8f9fa;
        border-radius: 12px;
    }
    .header h1 {
        font-size: 2.5rem;
        font-weight: 900;
        color: #343a40;
        margin-bottom: 5px;
    }
    .header p {
        font-size: 1.1rem;
        color: #6c757d;
    }
    .deal-card {
        background-color: #ffffff;
        border: 1px solid #e9ecef;
        border-radius: 12px;
        padding: 25px;
        margin-bottom: 20px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        transition: transform 0.2s, box-shadow 0.2s;
    }
    .deal-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
    }
    .partner-name {
        font-size: 1.5rem;
        font-weight: 700;
        color: #007bff;
        margin-bottom: 10px;
        border-bottom: 2px solid #007bff;
        display: inline-block;
        padding-bottom: 5px;
    }
    .description {
        font-size: 1.2rem;
        font-weight: 600;
        color: #343a40;
        margin-bottom: 8px;
    }
    .conditions {
        font-size: 1rem;
        color: #6c757d;
        margin-bottom: 15px;
        padding-left: 15px;
        border-left: 3px solid #ffc107;
    }
    .expiry-info {
        font-size: 0.9rem;
        color: #dc3545;
        font-weight: 500;
    }
    .days {
        font-weight: 700;
    }
    .no-deals {
        text-align: center;
        padding: 40px;
        color: #6c757d;
        font-size: 1.1rem;
        border: 2px dashed #e9ecef;
        border-radius: 12px;
    }

    /* ⭐️⭐️ 신규: 발급 완료 상세 카드 스타일 ⭐️⭐️ */
    .issued-detail-card {
        width: 100%;
        background-color: #ffffff;
        border: 2px solid #007bff;
        border-radius: 16px;
        padding: 40px 25px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        text-align: center;
        margin-top: 20px;
    }
    .issued-title {
        font-size: 2rem;
        font-weight: 800;
        color: #007bff;
        margin-bottom: 5px;
    }
    .issued-message {
        font-size: 1.1rem;
        color: #6c757d;
        margin-bottom: 20px;
    }
    .coupon-body-issued {
        border-top: 1px dashed #dee2e6;
        border-bottom: 1px dashed #dee2e6;
        padding: 20px 0;
        margin-bottom: 20px;
    }
    .description-text-issued {
        font-size: 1.6rem;
        font-weight: 700;
        color: #28a745;
        margin-bottom: 10px;
    }
    .conditions-text-issued, .expiry-time-issued {
        font-size: 1rem;
        color: #343a40;
        line-height: 1.5;
    }
    
    .map-button-issued, .share-button-issued, .back-button {
        display: block;
        width: 100%;
        font-size: 1.1rem;
        font-weight: 600;
        padding: 12px 0;
        border-radius: 8px;
        transition: background-color 0.3s;
        cursor: pointer;
        text-decoration: none;
        margin-bottom: 10px;
        border: none;
    }
    .map-button-issued {
        background-color: #28a745; /* 지도 버튼: 녹색 계열 */
        color: white;
    }
    .share-button-issued {
        background-color: #007bff; /* 공유 버튼: 파란색 */
        color: white;
    }
    .back-button {
        background-color: #6c757d;
        color: white;
        margin-top: 20px;
    }
    
    /* ⭐️ 쿠폰 받기 버튼 스타일 (개별 폼 안에 있음) ⭐️ */
    .get-coupon-button {
        width: 100%;
        padding: 14px 0;
        text-align: center;
        background-color: #ffc107; /* 노란색 계열로 눈에 띄게 */
        color: #333;
        border: none;
        border-radius: 8px;
        font-weight: 700;
        transition: background-color 0.2s;
        font-size: 1.2rem;
        margin-top: 10px;
    }
    .get-coupon-button:hover:not(:disabled) {
        background-color: #e0a800;
    }
    .get-coupon-button:disabled {
        background-color: #ccc;
        cursor: not-allowed;
    }
</style>
