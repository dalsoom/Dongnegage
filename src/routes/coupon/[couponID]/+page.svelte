<script>
	/** @type {import('./$types').PageData} */
	export let data;
	/** @type {import('./$types').ActionData} */
	export let form;

	// ⭐️ 반응형 변수 선언 ⭐️
	let coupon;
	let couponDeals;
	let storeInfo;
	let storeName;
	let description;
	let conditions;
	let mapUrl;

	// ⭐️ 만료 시각 계산 및 표시 변수 ⭐️
	let formattedExpiryDate = '';
	let dDay = '';

	// ⭐️ 반응형 데이터 추출 및 계산 ⭐️
	$: coupon = data.coupon;
	$: couponDeals = coupon?.CouponDeals || {};
	$: storeInfo = couponDeals.Stores || {};

	$: storeName = storeInfo.storeName;
	$: description = couponDeals.description;
	$: conditions = couponDeals.conditions;
	$: mapUrl = storeInfo.mapUrl; // 지도 URL을 가져옴
	$: isUsed = coupon.status === 'used'; // 사용 완료 상태

	// ⭐️ 만료일 계산 로직 (coupon이 업데이트될 때마다 실행) ⭐️
	$: {
		if (coupon && coupon.expires_at) {
			const expiryDate = new Date(coupon.expires_at);
			const today = new Date();
			
			// D-Day 계산 (시간은 무시하고 날짜만 비교)
			const timeDiff = expiryDate.getTime() - today.getTime();
			const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)); 
			
			// 정확한 시간 포맷 (예: 2025년 11월 11일 오후 7시 43분)
			const dateOptions = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
			formattedExpiryDate = expiryDate.toLocaleString('ko-KR', dateOptions);
			
			if (daysDiff <= 0) {
				dDay = '기한 만료';
			} else if (daysDiff === 1) {
				dDay = 'D-Day';
			} else {
				dDay = `D-${daysDiff - 1}`; // 오늘 포함 남은 일수 (하루 미만이면 D-Day, 2일 남았으면 D-1)
			}
		} else {
			dDay = '기한 정보 없음';
		}
	}

	// 3. "공유를 통해 저장할 수 있도록"
	async function shareCoupon() {
		// ... (기존 공유 로직 유지)
		if (navigator.share) {
			try {
				await navigator.share({
					title: '동네가게 제휴 쿠폰',
					text: `[${storeName}] ${description} (기한: ${formattedExpiryDate}까지)`,
					url: window.location.href
				});
			} catch (err) {
				console.error('공유 실패:', err);
			}
		} else {
			// alert('쿠폰 주소를 복사하여 저장하세요: ' + window.location.href);
			// ⭐️ alert 대신 커스텀 메시지 사용 (UX 개선) ⭐️
			alert('쿠폰 주소가 클립보드에 복사되었습니다.');
			navigator.clipboard.writeText(window.location.href); 
		}
	}

	let isLoading = false;

  // ⭐️⭐️ DEBUG: expires_at 값이 실제로 무엇인지 확인 ⭐️⭐️
$: {
    if (coupon) {
        console.log("DEBUG: Coupon object received.", coupon);
        console.log("DEBUG: Expires At Value:", coupon.expires_at); // ⬅️ 이 값이 null인지 확인
    }
}

// ... (후략)

</script>

<div class="coupon-page-container">
	
	<!-- 1. 사용 완료 상태 -->
	{#if isUsed || form?.success}
		<div class="coupon-used-card">
			<h1 class="text-3xl font-bold text-gray-500">{storeName}</h1>
			<p class="text-xl text-gray-500">{description}</p>
			<p class="text-3xl font-extrabold text-green-600 mt-6">✅ 사용 완료</p>
			{#if form?.message && form.message.includes('이미 사용됨')}
				<p class="text-lg mt-2 text-gray-500">이미 {formattedExpiryDate} 이전에 사용된 쿠폰입니다.</p>
			{/if}
		</div>
	
	<!-- 2. 미사용 쿠폰 상태 (새 디자인) -->
	{:else}
		<div class="coupon-card">
			
			<!-- 상단 헤더 & D-Day -->
			<div class="coupon-header">
				<p class="d-day-label">{dDay}</p>
				<h1 class="store-name">{storeName}</h1>
				<p class="expiry-time">{dDay}  까지 {formattedExpiryDate}</p>
			</div>
			
			<!-- 쿠폰 본문 -->
			<div class="coupon-body">
				<h2 class="description-text">{description}</h2>
				<p class="conditions-text">
					{conditions || '별도 사용 조건 없음'}
				</p>
			</div>

			<!-- ⭐️ 지도 링크 버튼 (UX 개선) ⭐️ -->
			{#if mapUrl}
				<a href={mapUrl} target="_blank" class="map-button">
					📍 가게 위치 지도 보기 (네이버 지도)
				</a>
			{/if}
			
			<!-- 폼 (사장님 확인) -->
			<form method="POST" class="coupon-actions">
				<p class="owner-warning">
					[사장님 전용] 손님은 절대 누르지 마세요!
				</p>
				<button	
					type="submit"
					class="use-button"
				>
					사용하기
				</button>
			</form>

			<!-- 공유/저장하기 버튼 -->
			<button	
				on:click={shareCoupon}
				class="share-button"
			>
				공유/저장하기 (카톡, 문자 등)
			</button>

			{#if form?.success === false}
				<p class="error-message mt-4">{form.message}</p>
			{/if}
		</div>
	{/if}
</div>

<style>
    /* 기본 레이아웃 */
    .coupon-page-container {
        max-width: 420px;
        margin: 0 auto;
        padding: 20px;
        min-height: 100vh;
        background-color: #f8f9fa; /* 은은한 배경색 */
        display: flex;
        justify-content: center;
        align-items: center;
        text-align: center;
    }

    /* 쿠폰 카드 (새로운 디자인) */
    .coupon-card {
        width: 100%;
        background-color: #ffffff;
        border: 1px solid #e9ecef;
        border-radius: 16px;
        padding: 30px 20px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    }
    
    .coupon-used-card {
        padding: 40px 20px;
        background-color: #e6f7e9; /* 사용 완료는 녹색 계열 */
        border: 2px solid #28a745;
        border-radius: 16px;
    }

    /* 헤더 및 만료일 */
    .coupon-header {
        margin-bottom: 25px;
        padding-bottom: 15px;
        border-bottom: 1px dashed #dee2e6;
    }

    .d-day-label {
        font-size: 1.2rem;
        font-weight: 900;
        color: #ff4500; /* D-Day는 눈에 띄게 주황/빨강 */
        margin-bottom: 5px;
    }

    .store-name {
        font-size: 2rem;
        font-weight: 800;
        color: #343a40;
        margin-bottom: 5px;
    }
    
    .expiry-time {
        font-size: 0.9rem;
        color: #6c757d;
        font-weight: 500;
    }

    /* 쿠폰 본문 */
    .coupon-body {
        margin-bottom: 30px;
        padding: 10px 0;
    }

    .description-text {
        font-size: 1.8rem;
        font-weight: 700;
        color: #007bff; /* 혜택 내용을 파란색으로 강조 */
        margin-bottom: 10px;
    }

    .conditions-text {
        font-size: 1.1rem;
        color: #6c757d;
        line-height: 1.5;
    }

    /* 버튼 스타일 */
    .coupon-actions {
        margin-top: 20px;
    }

    .owner-warning {
        font-size: 0.95rem;
        font-weight: 600;
        color: #28a745; /* 붉은색 대신 녹색으로 '확인' 강조 (위협적이지 않게) */
        margin-bottom: 10px;
        padding: 5px;
        border: 1px solid #28a745;
        border-radius: 4px;
    }

    .use-button {
        width: 100%;
        background-color: #28a745; /* ⭐️ 사용하기 버튼: 신뢰감 있는 녹색 ⭐️ */
        color: white;
        font-size: 1.5rem;
        font-weight: 700;
        padding: 15px 0;
        border: none;
        border-radius: 8px;
        transition: background-color 0.3s;
        cursor: pointer;
        margin-bottom: 15px;
    }

    .use-button:hover {
        background-color: #1e7e34;
    }
    
    .map-button, .share-button {
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
    }

    .map-button {
        background-color: #e9ecef; /* 지도 버튼: 밝은 회색 */
        color: #495057;
        border: 1px solid #ced4da;
    }

    .map-button:hover {
        background-color: #dee2e6;
    }

    .share-button {
        background-color: #6c757d; /* 공유 버튼: 차분한 회색 */
        color: white;
    }
    
    .share-button:hover {
        background-color: #5a6268;
    }

    .error-message {
        color: #dc3545;
        font-weight: 600;
    }
</style>
