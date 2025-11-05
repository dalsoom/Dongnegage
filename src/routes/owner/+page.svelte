<script>
    import { onMount } from 'svelte';
    import { createClient } from '@supabase/supabase-js';
    import { error } from '@sveltejs/kit';
    
    // Chart.js import는 Vercel 빌드 오류를 피하기 위해 삭제되었습니다. (CDN 로드 방식 사용)
    
    const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
        console.error("환경 설정 오류: Supabase URL 또는 키가 로드되지 않았습니다.");
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    let storeId = ''; 
    let isAuthenticated = false; 
    let storeName = ''; 
    let currentView = 'login';
    let loading = false;
    let errorMessage = '';

    // 📊 대시보드 지표 상태
    let totalIssued = 0; 
    let totalUsed = 0;   
    let chartCanvas; // 캔버스 요소 참조 변수

    let doughnutChart; 
    let ChartLibrary; // ⭐️ 로드된 Chart 객체를 저장할 변수 ⭐️
    
    // ⭐️ 사장님 인증 및 대시보드 로드 ⭐️
    async function authenticateAndLoad() {
        if (!storeId) {
            errorMessage = "가게 ID (UUID)를 입력해주세요.";
            return;
        }

        loading = true;
        errorMessage = '';

        // 1. Stores 테이블에서 ID로 가게 존재 여부 확인 및 이름 가져오기
        const { data: store, error: storeError } = await supabase
            .from('Stores')
            .select('storeName, id')
            .eq('id', storeId)
            .single();

        if (storeError || !store) {
            errorMessage = "유효하지 않은 가게 ID입니다. 다시 확인해주세요.";
            loading = false;
            return;
        }

        storeName = store.storeName;
        isAuthenticated = true;
        currentView = 'dashboard';
        
        // 2. 대시보드 데이터 로드 시작
        await loadDashboardData(storeId);
        loading = false;
    }
    
    // ⭐️ Chart.js 라이브러리 로드 함수 ⭐️
    async function loadChartLibrary() {
        // Chart 객체가 로드되지 않았다면 CDN을 통해 로드합니다.
        if (typeof window.Chart === 'undefined') {
            await new Promise(resolve => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/chart.js'; // ⭐️ CDN 주소 사용 ⭐️
                script.onload = () => {
                    ChartLibrary = window.Chart; // 전역 Chart 객체 참조
                    resolve();
                };
                document.head.appendChild(script);
            });
        } else {
             ChartLibrary = window.Chart; // 이미 로드되었다면 참조
        }
    }


    // 📊 대시보드 데이터 로드 함수 (데이터 로드 후 차트 생성)
    async function loadDashboardData(id) {
        // ⭐️ 차트 라이브러리가 로드될 때까지 기다립니다. ⭐️
        await loadChartLibrary();
        
        // [A] 우리 가게 QR에서 발급된 전체 쿠폰 수
        const { count: issuedCount, error: issuedError } = await supabase
            .from('IssuedCoupons')
            .select('*', { count: 'exact', head: true })
            .eq('origin_store_id', id);

        if (issuedError) { totalIssued = 0; } else { totalIssued = issuedCount || 0; }

        // [B] 우리 가게 쿠폰이 사용된 전체 수
        const { data: myDeals, error: dealsError } = await supabase
            .from('CouponDeals')
            .select('id')
            .eq('store_id', id);
        
        let usedCount = 0;
        if (!dealsError && myDeals) {
            const myDealIds = myDeals.map(deal => deal.id); 
            const { count: countResult } = await supabase
                .from('IssuedCoupons')
                .select('*', { count: 'exact', head: true })
                .in('deal_id', myDealIds)
                .eq('status', 'used');
            usedCount = countResult || 0;
        }
        totalUsed = usedCount;
        
        // ⭐️ 데이터 로드 완료 후 차트 업데이트 ⭐️
        updateChart(totalIssued, totalUsed);
    }
    
    // ⭐️ 차트 생성 및 업데이트 함수 ⭐️
    function updateChart(issued, used) {
        const unused = issued - used;
        const data = {
            labels: ['사용 완료', '미사용'],
            datasets: [{
                data: [used, unused < 0 ? 0 : unused], 
                backgroundColor: ['#28a745', '#ffc107'], 
                hoverBackgroundColor: ['#1e7e34', '#e0a800'],
                borderWidth: 1,
            }]
        };

        if (doughnutChart) {
            doughnutChart.data = data;
            doughnutChart.update();
        } else if (chartCanvas && ChartLibrary) { // ⬅️ ChartLibrary 객체가 존재하는지 확인
            // Vercel 빌드 성공을 위해 Chart 객체는 로드된 ChartLibrary를 사용합니다.
            doughnutChart = new ChartLibrary(chartCanvas, { 
                type: 'doughnut',
                data: data,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' },
                        title: {
                            display: true,
                            text: '전체 발급 쿠폰 사용 비율',
                            font: { size: 16 }
                        }
                    }
                }
            });
        }
    }
    
    // ⭐️ onMount에서 URL 쿼리 파라미터 읽기 ⭐️
    onMount(async () => {
        // 1. Chart.js 로드 (loadDashboardData 내부에서 비동기적으로 처리됨)
        
        // 2. URL 쿼리 파라미터 읽기 (기존 로직 유지)
        if (window && window.location) {
            const urlParams = new URLSearchParams(window.location.search);
            const idFromUrl = urlParams.get('id'); 
            
            if (idFromUrl) {
                storeId = idFromUrl; 
                authenticateAndLoad(); 
            }
        }
    });
</script>

<div class="owner-page-container">

    {#if currentView === 'login'}
        <!-- 로그인/인증 화면 -->
        <div class="card login-card">
            <h1 class="title">사장님 대시보드 접속</h1>
            <p class="subtitle">서비스 사용을 위해 가게 고유 ID를 입력해주세요.</p>
            
            <input 
                type="text" 
                bind:value={storeId} 
                placeholder="가게 ID (UUID) 입력"
                class="id-input"
                on:keydown={(e) => { if (e.key === 'Enter') authenticateAndLoad(); }}
            />
            
            {#if errorMessage}
                <p class="error-message">{errorMessage}</p>
            {/if}

            <button on:click={authenticateAndLoad} disabled={loading} class="login-button">
                {#if loading}
                    로딩 중...
                {:else}
                    대시보드 접속
                {/if}
            </button>
        </div>

    {:else if currentView === 'dashboard'}
        <!-- 대시보드 화면 -->
        <div class="card dashboard-card">
            <h1 class="dashboard-title">🎉 {storeName} 사장님 환영합니다!</h1>
            <p class="dashboard-subtitle">동네가게 제휴 쿠폰 현황</p>
            
            <div class="stats-grid">
                <div class="stat-box issued-box">
                    <p class="stat-label">QR 스캔 총 발급 수</p>
                    <p class="stat-value">{totalIssued}</p>
                </div>
                <div class="stat-box used-box">
                    <p class="stat-label">우리 가게 쿠폰 사용 수</p>
                    <p class="stat-value">{totalUsed}</p>
                </div>
            </div>
            
            <!-- ⭐️⭐️ 차트 캔버스 추가 ⭐️⭐️ -->
            <div class="chart-container">
                <canvas bind:this={chartCanvas}></canvas> 
            </div>

            <p class="data-note">데이터는 실시간 반영됩니다.</p>
            
            <button on:click={() => currentView = 'login'} class="logout-button">
                로그아웃 (ID 변경)
            </button>
        </div>
    {/if}
</div>

<style>
    .owner-page-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        background-color: #f0f2f5;
        font-family: 'Inter', sans-serif;
    }
    .card {
        background: white;
        padding: 40px;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
        width: 100%;
        max-width: 450px;
        text-align: center;
    }
    .title {
        font-size: 2rem;
        font-weight: 800;
        color: #333;
        margin-bottom: 10px;
    }
    .subtitle {
        font-size: 1rem;
        color: #666;
        margin-bottom: 30px;
    }
    .id-input {
        width: 100%;
        padding: 15px;
        margin-bottom: 15px;
        border: 2px solid #ccc;
        border-radius: 8px;
        box-sizing: border-box;
        font-size: 1rem;
        transition: border-color 0.3s;
    }
    .id-input:focus {
        border-color: #007bff;
        outline: none;
    }
    .login-button {
        width: 100%;
        padding: 15px;
        background-color: #28a745;
        color: white;
        font-size: 1.1rem;
        font-weight: 700;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: background-color 0.3s;
    }
    .login-button:hover:not(:disabled) {
        background-color: #1e7e34;
    }
    .login-button:disabled {
        background-color: #a9d4a9;
        cursor: not-allowed;
    }
    .error-message {
        color: #dc3545;
        margin-bottom: 10px;
    }

    /* 대시보드 스타일 */
    .dashboard-title {
        font-size: 2rem;
        font-weight: 800;
        color: #007bff;
        margin-bottom: 5px;
    }
    .dashboard-subtitle {
        font-size: 1.1rem;
        color: #6c757d;
        margin-bottom: 30px;
    }
    .stats-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 15px;
        margin-bottom: 20px;
    }
    .stat-box {
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
        border: 1px solid #e9ecef;
    }
    .stat-label {
        font-size: 0.9rem;
        color: #6c757d;
        margin-bottom: 5px;
    }
    .stat-value {
        font-size: 2.2rem;
        font-weight: 900;
    }
    .issued-box .stat-value {
        color: #ffc107; /* 발급 수는 경고색 */
    }
    .used-box .stat-value {
        color: #28a745; /* 사용 수는 성공색 */
    }
    .data-note {
        font-size: 0.85rem;
        color: #999;
        margin-bottom: 20px;
    }
    .logout-button {
        width: 100%;
        padding: 10px;
        background-color: #6c757d;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
    }
    
    /* ⭐️⭐️ 차트 컨테이너 스타일 ⭐️⭐️ */
    .chart-container {
        position: relative;
        height: 300px;
        width: 100%;
        margin-bottom: 30px;
    }
    
    /* 모바일 최적화 */
    @media (max-width: 500px) {
        .card {
            padding: 30px 20px;
            max-width: 95%;
        }
        .stats-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
