// 1. 필요한 '이사 도구' 4개(dotenv, glob, fs, csv, supabase)를 불러옵니다.

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { glob } = require('glob');
const csv = require('csv-parser');

require('dotenv').config({ path: path.join(__dirname, '.env') });


// 2. '비밀금고(.env)'에서 'Supabase 열쇠'를 '자동'으로 불러옵니다.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 3. '관리자 권한'으로 'Supabase'에 연결합니다.
if (!supabaseUrl || !supabaseKey) {
	console.error(
		"Error: SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 .env 파일에 없습니다."
	);
	process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// ----------------------------------------------------------------------
// [함수 A: Stores 테이블의 상세 정보 (ID, Name, Category) 조회 및 매핑]
// ----------------------------------------------------------------------
async function getStoreDetails() {
	console.log("\n--- Stores 상세 정보 조회 시작 ---");
	const { data: stores, error } = await supabase
		.from('Stores')
		.select('id, storeName, category'); // ⭐️ Category 정보 추가 ⭐️

	if (error) {
		console.error("Stores 데이터 조회 실패:", error.message);
		return [];
	}
	
	// CouponDeals 처리를 위한 이름-ID 매핑 객체도 여기서 생성
	const nameIdMap = {};
	stores.forEach(store => nameIdMap[store.storeName] = store.id);

	console.log(`✅ ${stores.length}개의 가게 상세 정보 조회 완료.`);
    // 전체 가게 정보 배열과 이름-ID 매핑 객체를 반환
	return { storeDetails: stores, nameIdMap }; 
}

// ----------------------------------------------------------------------
// [함수 B: CouponDeals 데이터 처리]
// ----------------------------------------------------------------------
async function importCouponDeals(nameIdMap) { // 이름-ID 매핑 객체를 받음
	console.log("\n--- CouponDeals 이사 시작 ---");
	const couponFile = path.join('./gage_list', '동네가게 - 쿠폰.csv');

	if (!fs.existsSync(couponFile)) {
		console.warn(`Warning: 쿠폰 파일 '${couponFile}'을 찾을 수 없습니다. 건너뜁니다.`);
		return 0;
	}

	let dealsToUpload = [];
	let totalCouponsProcessed = 0;
	let missingStoreCount = 0;

	await new Promise((resolve, reject) => {
		fs.createReadStream(couponFile)
			.pipe(csv())
			.on('data', (row) => {
				const storeName = row['이름'];
				const storeId = nameIdMap[storeName]; // ⭐️ 매핑 객체 사용 ⭐️

				if (!storeId) {
					missingStoreCount++;
					return;
				}

				const dealObject = {
					store_id: storeId,
					description: row['쿠폰내용'],
					conditions: row['사용조건'],
				};
				dealsToUpload.push(dealObject);
			})
			.on('end', async () => {
				if (dealsToUpload.length === 0) {
					console.log("처리할 쿠폰 딜 데이터가 없습니다.");
					resolve();
					return;
				}

				const { error } = await supabase
					.from('CouponDeals')
					.insert(dealsToUpload);

				if (error) {
					console.error("CouponDeals DB 업로드 실패:", error.message);
					reject(error);
				} else {
					totalCouponsProcessed = dealsToUpload.length;
					console.log(`✅ ${totalCouponsProcessed}개의 쿠폰 딜 이사 완료.`);
					if (missingStoreCount > 0) {
						console.warn(`⚠️ 경고: Stores 테이블에 없는 가게 ${missingStoreCount}개는 제외되었습니다.`);
					}
					resolve();
				}
			})
			.on('error', (error) => {
				console.error(`쿠폰 파일 읽기 실패:`, error.message);
				reject(error);
			});
	});

	return totalCouponsProcessed;
}

// ----------------------------------------------------------------------
// [함수 C: Affiliations 테이블 데이터 처리]
// ----------------------------------------------------------------------
async function importAffiliations(allStores) { // ⭐️ ID/Name/Category 배열을 받음 ⭐️
	console.log("\n--- Affiliations (제휴 관계) 이사 시작 ---");
	
	if (allStores.length === 0) {
		console.warn("경고: Stores 데이터가 없어 Affiliations를 처리할 수 없습니다.");
		return 0;
	}

	const affiliationsToUpload = [];
	const existingPairs = new Set(); 

	for (const originStore of allStores) {
		for (const targetStore of allStores) {
			
			// 1. [업종 배제 로직] 동일 업종이 아닌 경우만 선택
			if (
				originStore.id !== targetStore.id && 
				originStore.category !== targetStore.category
			) {
				// 2. [양방향 중복 방지] 사전 순서로 정렬
				const storeA = originStore.id < targetStore.id ? originStore.id : targetStore.id;
				const storeB = originStore.id < targetStore.id ? targetStore.id : originStore.id;
				
				const pairKey = `${storeA}-${storeB}`;
				
				if (!existingPairs.has(pairKey)) {
					affiliationsToUpload.push({
						store_a_id: storeA,
						store_b_id: storeB,
					});
					existingPairs.add(pairKey);
				}
			}
		}
	}
	
	if (affiliationsToUpload.length === 0) {
		console.log("처리할 제휴 관계 데이터가 없습니다.");
		return 0;
	}
	
	const { error } = await supabase
		.from('Affiliations')
		.upsert(affiliationsToUpload, { 
			onConflict: 'store_a_id, store_b_id', 
			ignoreDuplicates: true 
		});

	if (error) {
		console.error("Affiliations DB 업로드 실패:", error.message);
		return 0;
	} else {
		console.log(`✅ 총 ${affiliationsToUpload.length}개의 제휴 관계 이사 완료.`);
		return affiliationsToUpload.length;
	}
}

// ----------------------------------------------------------------------
// [함수 D: Stores 데이터 처리 (기존 로직)]
// ----------------------------------------------------------------------
async function importStores() {
	console.log("--- Stores 데이터 이사를 시작합니다... ---");
	// ... (기존 importStores 함수 내용 유지)
	// (이 함수는 'gage_list'의 '동네가게 - 쿠폰.csv'를 제외하고 처리합니다.)
	// ... (Code continues with original importStores logic)
    
    // 1단계: 'gage_list' 폴더의 '모든 .csv' 파일을 찾습니다.
	const csvFiles = await glob('./gage_list/*.csv');
	
	if (csvFiles.length === 0) {
		console.error("Error: 'gage_list' 폴더에서 CSV 파일을 찾을 수 없습니다.");
		return 0;
	}

	// ⭐️ 쿠폰 파일은 여기서 처리하지 않도록 제외합니다. ⭐️
	const storeFiles = csvFiles.filter(file => !file.includes('쿠폰.csv'));

	console.log(`총 ${storeFiles.length}개의 가게 CSV 파일을 찾았습니다.`);

	let totalStoresProcessed = 0;

	// 2단계: '모든 CSV'를 '하나씩' 읽습니다.
	for (const file of storeFiles) { // ⭐️ storeFiles 순회 ⭐️
		console.log(`--- '${file}' 파일 처리 중... ---`);
		const storesToUpload = [];

		await new Promise((resolve, reject) => {
			fs.createReadStream(file)
				.pipe(csv())
				.on('data', (row) => {

					const storeObject = {
						storeName: row['이름'],
						category: row['업종'],
						mapUrl: row['지도'],
						address: row['주소'],
						contact: row['컨택'],
						reviewCount: Number(row['리뷰수']) || 0,
						followerCount: Number(row['팔로워수']) || 0,
						rfIndex: parseFloat(row['R/F지수']) || 0,
						note: row['비고1'],
						plan: row['플랜'],
						region: row['지역']
					};

					if (storeObject.mapUrl) {
						storesToUpload.push(storeObject);
					}
				})
				.on('end', async () => {
					if (storesToUpload.length === 0) {
						console.log(`'${file}' 파일에 처리할 데이터가 없습니다.`);
						resolve();
						return;
					}

					const { data: dbData, error } = await supabase 
						.from('Stores')
						.upsert(storesToUpload, {
							onConflict: 'mapUrl',
							ignoreDuplicates: true
						});

					if (error) {
						console.error(`'${file}' 파일 DB 업로드 실패:`, error.message);
						reject(error);
					} else {
						const insertedCount = storesToUpload.length;
						totalStoresProcessed += insertedCount;
						console.log(`'${file}' 파일에서 ${insertedCount}개의 가게 처리 완료.`);
						resolve();
					}
				})
				.on('error', (error) => {
					console.error(`'${file}' 파일 읽기 실패:`, error.message);
					reject(error);
				});
		});
	}
	return totalStoresProcessed;
}

// ----------------------------------------------------------------------
// [메인 실행 함수: 전체 프로세스 관리]
// ----------------------------------------------------------------------
async function main() {
	console.log("--- [동네가게 시스템 데이터 이사 시작] ---");

	// 1단계: 가게 데이터 삽입 (CouponDeals/Affiliations보다 먼저 완료되어야 함)
	const totalStores = await importStores();

	// 2단계: Stores 테이블에서 필요한 상세 정보 조회
	const { storeDetails, nameIdMap } = await getStoreDetails(); 
	
	if (storeDetails.length === 0) {
		console.warn("경고: Stores 데이터가 없어 쿠폰/제휴 관계를 처리할 수 없습니다.");
		return;
	}

	// 3단계: CouponDeals 데이터 삽입
	const totalCoupons = await importCouponDeals(nameIdMap); // 이름-ID 매핑 객체 사용

	// 4단계: Affiliations 데이터 삽입 (Category 정보가 필요함)
	const totalAffiliations = await importAffiliations(storeDetails); // 상세 정보 배열 사용

	// 5단계: 최종 결과 보고
	console.log("\n--- [데이터 이사 최종 완료] ---");
	console.log(`✅ 총 ${totalStores}개의 가게 DB '이사' 완료.`);
	console.log(`✅ 총 ${totalCoupons}개의 쿠폰 딜 DB '이사' 완료.`);
	console.log(`✅ 총 ${totalAffiliations}개의 제휴 관계 DB '이사' 완료.`);
}


// --- 6. "이사" 실행 ---
main();