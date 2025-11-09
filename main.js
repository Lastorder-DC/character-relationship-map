// --- 캔버스 및 컨텍스트 ---
const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');

// --- UI 요소 ---
const addLegendBtn = document.getElementById('addLegendBtn');
const legendText = document.getElementById('legendText');
const legendColor = document.getElementById('legendColor');
const legendDisplay = document.getElementById('legendDisplay');
const characterDisplay = document.getElementById('characterDisplay');

const addNodeBtn = document.getElementById('addNodeBtn');
const nodeModal = document.getElementById('nodeModal');
const cancelAddNode = document.getElementById('cancelAddNode');
const confirmAddNode = document.getElementById('confirmAddNode');
const nodeNameInput = document.getElementById('nodeNameInput');
const nodeImageInput = document.getElementById('nodeImageInput');
const nodeColorInput = document.getElementById('nodeColorInput');

const exportBtn = document.getElementById('exportBtn');
const clearBtn = document.getElementById('clearBtn');
const arrangeCircleBtn = document.getElementById('arrangeCircleBtn');
const statusArea = document.getElementById('statusArea');

const exportJsonBtn = document.getElementById('exportJsonBtn');
const importJsonBtn = document.getElementById('importJsonBtn');
const importJsonInput = document.getElementById('importJsonInput');

// --- 데이터 상태 ---
let nodes = []; // { id, x, y, radius, name, color, image? }
let lines = []; // { from, to, color, label }
let lastNodeId = 0; // 간단한 ID 부여용

const defaultLegend = [
    { text: '사랑 중 ♥', color: '#F87171' },
    { text: '신뢰 / 사이 좋음', color: '#93C5FD' },
    { text: '평범하게 아는 사이', color: '#A7F3D0' },
    { text: '친구 ~ 지인', color: '#FEF08A' },
    { text: '사이 안 좋음', color: '#E9D5FF' },
    { text: '사이 나쁨 ~ 앙숙', color: '#737373' }
];
let legend = [...defaultLegend];

// --- 상호작용 상태 ---
let selectedColor = '#000000';
let selectedLabel = '';
let selectedLegendEl = null;
let selection = null; // 첫 번째 선택된 노드 ID (관계 그리기용)
let highlightedNodeId = null; // 하이라이트된 노드 ID (관계 보기용)

let isDragging = false;
let draggingNode = null;
let dragStartX = 0;
let dragStartY = 0;

// ===================================================================
// 초기화
// ===================================================================

function initialize() {
    resizeCanvas();
    updateLegendDisplay();
    updateCharacterDisplay();
    draw();
    setupEventListeners();
}

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    draw(); // 리사이즈 후 다시 그리기
}

// ===================================================================
// 이벤트 리스너 설정
// ===================================================================

function setupEventListeners() {
    window.addEventListener('resize', () => {
        resizeCanvas();
        draw();
    });

    // 캔버스 이벤트
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseout', onMouseOut);
    
    // 모바일 터치 이벤트
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchEnd);

    // 사이드바 버튼
    addLegendBtn.addEventListener('click', handleAddLegend);
    addNodeBtn.addEventListener('click', () => nodeModal.classList.remove('hidden'));
    exportBtn.addEventListener('click', exportAsPNG);
    clearBtn.addEventListener('click', clearAll);
    arrangeCircleBtn.addEventListener('click', arrangeInCircle);
    
    // JSON 버튼
    exportJsonBtn.addEventListener('click', exportAsJSON);
    importJsonBtn.addEventListener('click', () => importJsonInput.click());
    importJsonInput.addEventListener('change', handleImportJSON);

    // 모달 버튼
    cancelAddNode.addEventListener('click', () => {
        nodeModal.classList.add('hidden');
        resetNodeModal();
    });
    confirmAddNode.addEventListener('click', handleAddNode);
    
    // --- 최적화: 이벤트 위임 ---
    // 사이드바 목록의 클릭 이벤트를 부모 요소에서 처리
    legendDisplay.addEventListener('click', handleLegendDisplayClick);
    characterDisplay.addEventListener('click', handleCharacterDisplayClick);
}

// ===================================================================
// 그리기 (Draw) 함수 - 메인
// ===================================================================

function draw() {
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, rect.width, rect.height);
    
    // 하이라이트 모드일 때 관련된 노드/선 식별
    const relatedNodeIds = getRelatedNodeIds();

    drawAllLines(relatedNodeIds);
    drawAllNodes(relatedNodeIds);
    drawAllHighlights();
}

/**
 * 하이라이트 모드일 때, 현재 하이라이트된 노드와 연결된 모든 노드의 ID Set을 반환합니다.
 * 하이라이트 모드가 아니면 null을 반환합니다.
 */
function getRelatedNodeIds() {
    if (highlightedNodeId === null) return null;
    
    const relatedNodeIds = new Set();
    relatedNodeIds.add(highlightedNodeId); // 자기 자신 추가
    lines.forEach(line => {
        if (line.from === highlightedNodeId) relatedNodeIds.add(line.to);
        if (line.to === highlightedNodeId) relatedNodeIds.add(line.from);
    });
    return relatedNodeIds;
}

/** 캔버스의 모든 관계선을 그립니다. */
function drawAllLines(relatedNodeIds) {
    ctx.lineCap = 'round';
    lines.forEach(line => {
        // 하이라이트 모드일 때, 관련 없는 선은 건너뛰기
        if (relatedNodeIds !== null && line.from !== highlightedNodeId && line.to !== highlightedNodeId) {
            return;
        }
        
        const fromNode = nodes.find(n => n.id === line.from);
        const toNode = nodes.find(n => n.id === line.to);
        if (!fromNode || !toNode) return;

        drawSingleLine(fromNode, toNode, line);
    });
}

/** 개별 관계선과 레이블을 그립니다. */
function drawSingleLine(fromNode, toNode, line) {
    // 선 그리기
    ctx.beginPath();
    ctx.moveTo(fromNode.x, fromNode.y);
    ctx.lineTo(toNode.x, toNode.y);
    ctx.strokeStyle = line.color;
    ctx.lineWidth = 4;
    ctx.stroke();

    // 선 중앙에 레이블 텍스트 그리기
    const midX = (fromNode.x + toNode.x) / 2;
    const midY = (fromNode.y + toNode.y) / 2;
    
    // 텍스트가 뒤집히지 않도록 각도 보정
    let angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
    if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
        angle += Math.PI; // 180도 회전
    }

    ctx.save();
    ctx.translate(midX, midY);
    ctx.rotate(angle);
    
    ctx.font = 'bold 12px Inter';
    const textMetrics = ctx.measureText(line.label);
    const textWidth = textMetrics.width + 10;
    const textHeight = 18;
    
    // 텍스트 배경 (흰색)
    ctx.fillStyle = 'white';
    ctx.fillRect(-textWidth / 2, -textHeight / 2 - 2, textWidth, textHeight);
    
    // 텍스트
    ctx.fillStyle = line.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(line.label, 0, 0);
    
    ctx.restore();
}

/** 캔버스의 모든 노드(캐릭터)를 그립니다. */
function drawAllNodes(relatedNodeIds) {
    nodes.forEach(node => {
        const isDimmed = (relatedNodeIds !== null && !relatedNodeIds.has(node.id));
        drawSingleNode(node, isDimmed);
    });
}

/** 개별 노드(캐릭터)와 이름을 그립니다. */
function drawSingleNode(node, isDimmed) {
    ctx.save();
    
    if (isDimmed) {
        ctx.globalAlpha = 0.2; // 관련 없는 노드 흐리게
    }

    // 1. 노드 원 (이미지 또는 단색)
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);

    ctx.save();
    if (node.image) {
        // 이미지 그리기 (원형 클리핑)
        ctx.clip();
        try {
            ctx.drawImage(node.image, node.x - node.radius, node.y - node.radius, node.radius * 2, node.radius * 2);
        } catch (e) {
            console.error("Image drawing error:", e);
            ctx.fillStyle = node.color; // 오류 시 대체 색상
            ctx.fill();
        }
    } else {
        // 단색원 그리기
        ctx.fillStyle = node.color;
        ctx.fill();
    }
    ctx.restore();

    // 2. 노드 테두리
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 3. 이름 텍스트 (배경 포함)
    ctx.textAlign = 'center';
    ctx.font = '14px Inter';
    const textY = node.y + node.radius + 15;
    const textMetrics = ctx.measureText(node.name);
    const textWidth = textMetrics.width + 10;
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; // 반투명 흰색 배경
    ctx.fillRect(node.x - textWidth / 2, textY - 12, textWidth, 18);
    
    ctx.fillStyle = 'black'; // 텍스트 색상
    ctx.fillText(node.name, node.x, textY);

    ctx.restore(); // (dimming 처리를 위한) globalAlpha 복원
}

/** 선택 및 하이라이트 테두리를 그립니다. */
function drawAllHighlights() {
    // 1. 관계 그리기(selection) 하이라이트 (파란색)
    if (selection) { 
        const node = nodes.find(n => n.id === selection);
        if (node) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius + 5, 0, Math.PI * 2);
            ctx.strokeStyle = '#3b82f6'; // 파란색
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    }

    // 2. 관계 보기(highlightedNodeId) 하이라이트 (주황색 점선)
    //    (관계 그리기 모드가 아닐 때만 표시)
    if (highlightedNodeId !== null && !selection) {
        const node = nodes.find(n => n.id === highlightedNodeId);
        if (node) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius + 5, 0, Math.PI * 2);
            ctx.strokeStyle = '#f59e0b'; // 주황색
            ctx.lineWidth = 4;
            ctx.setLineDash([5, 5]); // 점선
            ctx.stroke();
            ctx.setLineDash([]); // 점선 해제
        }
    }
}

// ===================================================================
// 캔버스 마우스/터치 이벤트 핸들러
// ===================================================================

function onMouseDown(e) {
    const { x, y } = getCanvasCoordinates(e);
    handleDragStart(x, y);
}

function onMouseMove(e) {
    if (!isDragging) return;
    const { x, y } = getCanvasCoordinates(e);
    handleDragMove(x, y);
}

function onMouseUp(e) {
    const { x, y } = getCanvasCoordinates(e);
    handleDragEnd(x, y);
}

function onMouseOut(e) {
    if(isDragging) {
        isDragging = false;
        draggingNode = null;
    }
}

function onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
        const { x, y } = getCanvasCoordinates(e.touches[0]);
        handleDragStart(x, y);
    }
}

function onTouchMove(e) {
    e.preventDefault();
    if (!isDragging || e.touches.length !== 1) return;
    const { x, y } = getCanvasCoordinates(e.touches[0]);
    handleDragMove(x, y);
}

function onTouchEnd(e) {
    if (isDragging) {
        // 터치 종료 시점의 좌표는 알기 어려우므로, 드래그 중이던 노드의 현재 위치를 사용
        handleDragEnd(draggingNode.x, draggingNode.y);
    }
}

// ===================================================================
// 공통 드래그/클릭 로직
// ===================================================================

function handleDragStart(x, y) {
    dragStartX = x;
    dragStartY = y;

    const clickedNode = findNodeAt(x, y);

    if (clickedNode) {
        isDragging = true;
        draggingNode = clickedNode;
    } else {
        // 빈 공간 클릭: 모든 선택/하이라이트 해제
        if (selection) {
            selection = null;
            statusArea.textContent = '선택이 취소되었습니다.';
        }
        if (highlightedNodeId) {
            highlightedNodeId = null;
            statusArea.textContent = '전체 관계 보기로 돌아갑니다.';
        }
        // 관계 정의 목록에서도 'active' 해제
        if (selectedLegendEl) {
            selectedLegendEl.classList.remove('active');
            selectedLegendEl = null;
            selectedLabel = '';
        }
        draw();
    }
}

function handleDragMove(x, y) {
     if (!isDragging || !draggingNode) return;
     draggingNode.x = x;
     draggingNode.y = y;
     draw();
}

function handleDragEnd(x, y) {
    if (!isDragging) return;

    // 드래그가 거의 없었다면 '클릭'으로 간주
    const isClick = Math.abs(x - dragStartX) < 5 && Math.abs(y - dragStartY) < 5;

    if (isClick && draggingNode) {
        if (selectedLabel) {
            // 1. 관계 그리기 모드 (사이드바에서 관계 선택됨)
            handleLineDrawClick(draggingNode);
        } else {
            // 2. 관계 보기 모드 (선택된 관계 없음)
            handleHighlightClick(draggingNode);
        }
    }
    
    isDragging = false;
    draggingNode = null;
}

/** 노드 클릭 핸들러 (관계선 연결용) */
function handleLineDrawClick(clickedNode) {
    if (!selectedLabel) {
        statusArea.textContent = '먼저 사이드바에서 관계를 선택하세요.';
        return;
    }

    if (selection === null) {
        // 첫 번째 노드 선택
        selection = clickedNode.id;
        statusArea.textContent = `"${clickedNode.name}" 선택됨. 두 번째 캐릭터를 선택하세요.`;
        draw();
    } else {
        // 두 번째 노드 선택
        if (selection === clickedNode.id) {
            // 같은 노드 다시 클릭 -> 선택 취소
            selection = null;
            statusArea.textContent = '선택이 취소되었습니다.';
            draw();
        } else {
            // 두 노드 간에 선 추가
            const fromNode = nodes.find(n => n.id === selection);
            lines.push({
                from: selection,
                to: clickedNode.id,
                color: selectedColor,
                label: selectedLabel
            });
            
            statusArea.textContent = `"${fromNode.name}" → "${clickedNode.name}" (${selectedLabel}) 관계 추가됨.`;
            selection = null; // 선택 초기화
            draw();
        }
    }
}

/** 노드 클릭 핸들러 (관계 하이라이트용) */
function handleHighlightClick(clickedNode) {
    if (highlightedNodeId === clickedNode.id) {
        // 이미 하이라이트된 노드를 클릭 -> 하이라이트 해제
        highlightedNodeId = null;
        statusArea.textContent = '전체 관계 보기로 돌아갑니다.';
    } else {
        // 새 노드 하이라이트
        highlightedNodeId = clickedNode.id;
        statusArea.textContent = `"${clickedNode.name}"의 관계를 보는 중... (빈 곳 클릭 시 해제)`;
    }
    selection = null; // 라인 그리기 모드 해제
    draw();
}

// ===================================================================
// 사이드바 UI 핸들러 (추가/삭제/업데이트)
// ===================================================================

// --- 관계 (Legend) ---

/** '관계 추가' 버튼 클릭 핸들러 */
function handleAddLegend() {
    const text = legendText.value.trim();
    const color = legendColor.value;
    if (!text) {
        alert('관계 이름을 입력하세요.');
        return;
    }

    legend.push({ text, color });
    
    updateLegendDisplay();
    legendText.value = '';
    statusArea.textContent = `"${text}" 관계가 추가되었습니다.`;
}

/** '관계 정의' 목록의 클릭 이벤트 핸들러 (이벤트 위임) */
function handleLegendDisplayClick(e) {
    const legendItem = e.target.closest('.legend-item');
    if (!legendItem) return;

    const deleteBtn = e.target.closest('.delete-legend-btn');
    const index = parseInt(legendItem.dataset.index);

    if (deleteBtn) {
        // '삭제' 버튼 클릭
        e.stopPropagation();
        handleDeleteLegend(index);
    } else {
        // '선택' (항목 자체) 클릭
        const item = legend[index];
        handleSelectLegend(legendItem, item);
    }
}

/** 관계 항목 '선택' 로직 */
function handleSelectLegend(el, item) {
    if (selectedLegendEl === el) {
        // 이미 선택된 항목 다시 클릭 -> 선택 해제
        el.classList.remove('active');
        selectedLegendEl = null;
        selectedColor = '#000000';
        selectedLabel = '';
        selection = null;
        highlightedNodeId = null;
        statusArea.textContent = '관계 선택이 해제되었습니다. 캐릭터를 클릭하여 관계를 보세요.';
        draw();
    } else {
        // 새 항목 선택
        if (selectedLegendEl) {
            selectedLegendEl.classList.remove('active');
        }
        selectedColor = item.color;
        selectedLabel = item.text;
        selectedLegendEl = el;
        el.classList.add('active');
        
        selection = null; // 관계 종류를 바꾸면 노드 선택 초기화
        highlightedNodeId = null; 
        draw();
        statusArea.textContent = `"${item.text}" 관계 선택됨. 첫 번째 캐릭터를 선택하세요.`;
    }
}

/** 관계 항목 '삭제' 로직 */
function handleDeleteLegend(indexToDelete) {
    const deletedItem = legend[indexToDelete];
    if (!deletedItem) return;

    if (!confirm(`"${deletedItem.text}" 관계를 삭제하시겠습니까? 이 관계를 사용하는 모든 선이 삭제됩니다.`)) {
        return;
    }
    
    legend.splice(indexToDelete, 1);
    // 이 관계를 사용하던 모든 선 삭제
    lines = lines.filter(line => !(line.label === deletedItem.text && line.color === deletedItem.color));

    // 선택 상태 초기화
    if (selectedLegendEl && parseInt(selectedLegendEl.dataset.index) === indexToDelete) {
        selectedLegendEl = null;
        selectedColor = '#000000';
        selectedLabel = '';
        selection = null;
    }

    updateLegendDisplay(); // 목록 다시 그리기
    draw();
    statusArea.textContent = `"${deletedItem.text}" 관계를 삭제했습니다.`;
}

/** 사이드바의 '관계 정의' 목록 UI를 다시 그립니다. */
function updateLegendDisplay() {
    legendDisplay.innerHTML = ''; // 초기화
    if (legend.length === 0) {
        legendDisplay.innerHTML = '<p class="text-sm text-gray-500">정의된 관계가 없습니다.</p>';
        return;
    }

    legend.forEach((item, index) => {
        const el = document.createElement('div');
        // data-index를 추가하여 이벤트 위임 시 인덱스를 알 수 있게 함
        el.className = 'legend-item p-2 border rounded-md flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors';
        el.dataset.index = index;
        
        // 현재 선택된 항목이면 active 클래스 추가
        if (selectedLegendEl && parseInt(selectedLegendEl.dataset.index) === index) {
            el.classList.add('active');
            selectedLegendEl = el; // DOM 참조 갱신
        }

        el.innerHTML = `
            <div class="flex items-center overflow-hidden mr-2">
                <div class="w-5 h-5 rounded-full mr-3 flex-shrink-0" style="background-color: ${item.color}; border: 1px solid #00000030;"></div>
                <span class="font-medium truncate" title="${item.text}">${item.text}</span>
            </div>
            <button data-index="${index}" class="delete-legend-btn text-gray-400 hover:text-red-500 font-bold px-2 rounded-full flex-shrink-0">&times;</button>
        `;
        legendDisplay.appendChild(el);
    });
}


// --- 캐릭터 (Node) ---

/** '새 캐릭터 추가' 모달의 '추가하기' 버튼 핸들러 */
function handleAddNode() {
    const name = nodeNameInput.value.trim();
    if (!name) {
        alert('캐릭터 이름을 입력하세요.');
        return;
    }
    
    const file = nodeImageInput.files[0];
    const color = nodeColorInput.value;
    const rect = canvas.getBoundingClientRect();

    const newNode = {
        id: ++lastNodeId,
        x: Math.random() * (rect.width - 100) + 50, // 캔버스 내 랜덤 위치
        y: Math.random() * (rect.height - 100) + 50,
        radius: 40,
        name: name,
        color: color,
        image: null
    };

    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                newNode.image = img;
                nodes.push(newNode);
                updateCharacterDisplay();
                draw();
            };
            img.onerror = () => {
                console.error("Image loading failed.");
                nodes.push(newNode); // 이미지 로드 실패 시 단색원으로 추가
                updateCharacterDisplay();
                draw();
            }
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    } else {
        nodes.push(newNode); // 이미지 없이 단색원으로 추가
        updateCharacterDisplay();
        draw();
    }

    nodeModal.classList.add('hidden');
    resetNodeModal();
    statusArea.textContent = `"${name}" 캐릭터가 추가되었습니다.`;
}

/** 캐릭터 추가 모달 폼 초기화 */
function resetNodeModal() {
    nodeNameInput.value = '';
    nodeImageInput.value = ''; // 파일 입력 초기화
    nodeColorInput.value = '#cbd5e1';
}

/** '캐릭터' 목록의 클릭 이벤트 핸들러 (이벤트 위임) */
function handleCharacterDisplayClick(e) {
    const deleteBtn = e.target.closest('.delete-node-btn');
    if (deleteBtn) {
        e.stopPropagation();
        const idToDelete = parseInt(deleteBtn.dataset.id);
        handleDeleteNode(idToDelete);
    }
}

/** 캐릭터 '삭제' 로직 */
function handleDeleteNode(idToDelete) {
    const deletedNode = nodes.find(n => n.id === idToDelete);
    if (!deletedNode) return;

    if (!confirm(`"${deletedNode.name}" 캐릭터를 삭제하시겠습니까? 연결된 모든 관계선도 함께 삭제됩니다.`)) {
        return;
    }

    // 1. 노드 삭제
    nodes = nodes.filter(n => n.id !== idToDelete);
    // 2. 이 노드와 연결된 모든 선 삭제
    lines = lines.filter(line => line.from !== idToDelete && line.to !== idToDelete);

    // 3. 현재 선택/하이라이트 상태 초기화
    if (selection === idToDelete) selection = null;
    if (highlightedNodeId === idToDelete) highlightedNodeId = null;

    updateCharacterDisplay();
    draw();
    statusArea.textContent = `"${deletedNode.name}" 캐릭터를 삭제했습니다.`;
}

/** 사이드바의 '캐릭터' 목록 UI를 다시 그립니다. */
function updateCharacterDisplay() {
    characterDisplay.innerHTML = ''; // Clear
    if (nodes.length === 0) {
        characterDisplay.innerHTML = '<p class="text-sm text-gray-500">추가된 캐릭터가 없습니다.</p>';
        return;
    }

    nodes.forEach(node => {
        const el = document.createElement('div');
        el.className = 'p-2 border rounded-md flex items-center justify-between hover:bg-gray-100';
        
        let imgHtml = '';
        if (node.image) {
            imgHtml = `<img src="${node.image.src}" class="w-8 h-8 rounded-full mr-3 object-cover flex-shrink-0">`;
        } else {
            imgHtml = `<div class="w-8 h-8 rounded-full mr-3 flex-shrink-0" style="background-color: ${node.color}; border: 1px solid #00000030;"></div>`;
        }

        el.innerHTML = `
            <div class="flex items-center overflow-hidden mr-2">
                ${imgHtml}
                <span class="font-medium truncate" title="${node.name}">${node.name}</span>
            </div>
            <button data-id="${node.id}" class="delete-node-btn text-gray-400 hover:text-red-500 font-bold px-2 rounded-full flex-shrink-0">&times;</button>
        `;
        characterDisplay.appendChild(el);
    });
}


// ===================================================================
// 도구 (Tools) 핸들러
// ===================================================================

/** '원형으로 정렬' */
function arrangeInCircle() {
    if (nodes.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    // 반경을 캔버스 크기에 비례하게 (작은 쪽 기준)
    const radius = Math.min(rect.width, rect.height) * 0.35;
    const angleStep = (Math.PI * 2) / nodes.length;

    nodes.forEach((node, index) => {
        // -PI/2 (90도)를 빼서 12시 방향(위쪽)부터 시작
        node.x = centerX + radius * Math.cos(angleStep * index - Math.PI / 2); 
        node.y = centerY + radius * Math.sin(angleStep * index - Math.PI / 2);
    });

    draw();
    statusArea.textContent = '캐릭터를 원형으로 정렬했습니다.';
}

/** 'PNG로 저장' */
function exportAsPNG() {
    // 하이라이트/선택 테두리를 지우고 깨끗한 이미지로 저장
    const currentSelection = selection;
    const currentHighlight = highlightedNodeId;
    selection = null;
    highlightedNodeId = null;
    draw();
    
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'character-relationship-map.png';
    link.href = dataUrl;
    link.click();
    
    // 원래 선택 상태 복원
    selection = currentSelection;
    highlightedNodeId = currentHighlight;
    draw();
    
    statusArea.textContent = 'PNG 이미지로 저장되었습니다.';
}

/** 'JSON으로 내보내기' */
function exportAsJSON() {
    // 직렬화 가능한 노드 배열 생성 (Image 객체 -> imageSrc 문자열로)
    const serializableNodes = nodes.map(node => {
        const nodeCopy = { ...node };
        if (node.image) {
            nodeCopy.imageSrc = node.image.src; // Data URL 저장
        }
        delete nodeCopy.image; // 직렬화 불가능한 Image 객체 제거
        return nodeCopy;
    });

    const data = {
        nodes: serializableNodes,
        lines: lines,
        legend: legend,
        lastNodeId: lastNodeId // ID 카운터도 저장
    };

    const dataStr = JSON.stringify(data, null, 2); // 예쁘게 포맷팅
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.download = 'character-map-data.json';
    link.href = url;
    link.click();
    
    URL.revokeObjectURL(url); // 메모리 해제
    statusArea.textContent = 'JSON 파일로 내보냈습니다.';
}

/** 'JSON에서 가져오기' (파일 선택 시) */
function handleImportJSON(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);

            if (!data.nodes || !data.lines || !data.legend) {
                alert('잘못된 JSON 파일 형식입니다. (nodes, lines, legend 키가 필요합니다)');
                e.target.value = ''; // input 초기화
                return;
            }

            if (!confirm('현재 작업을 지우고 새 데이터를 가져오시겠습니까?')) {
                e.target.value = ''; // input 초기화
                return;
            }

            // 데이터 로드
            lines = data.lines;
            legend = data.legend;
            lastNodeId = data.lastNodeId || 0; // 이전 버전 호환
            nodes = [];

            // 이미지 로딩을 포함한 노드 재생성 (비동기)
            const nodePromises = data.nodes.map(nodeData => {
                if (nodeData.id > lastNodeId) {
                    lastNodeId = nodeData.id;
                }

                const newNode = { ...nodeData, image: null };
                delete newNode.imageSrc; // 아래에서 처리

                if (nodeData.imageSrc) {
                    // 이미지가 있으면 비동기 로드
                    return new Promise((resolve) => {
                        const img = new Image();
                        img.onload = () => {
                            newNode.image = img;
                            resolve(newNode);
                        };
                        img.onerror = () => {
                            console.warn(`Failed to load image for ${newNode.name} from imported data.`);
                            resolve(newNode); // 이미지 로드 실패해도 노드는 추가
                        };
                        img.src = nodeData.imageSrc;
                    });
                } else {
                    // 이미지가 없으면 바로 반환
                    return Promise.resolve(newNode);
                }
            });

            // 모든 노드(와 이미지) 로드가 완료된 후 UI 갱신
            Promise.all(nodePromises).then(loadedNodes => {
                nodes = loadedNodes;
                
                // 모든 상호작용 상태 초기화
                resetInteractionState();

                // UI 갱신
                updateLegendDisplay();
                updateCharacterDisplay();
                draw();
                statusArea.textContent = 'JSON에서 데이터를 성공적으로 가져왔습니다.';
            });

        } catch (error) {
            alert('파일을 읽는 중 오류가 발생했습니다: ' + error.message);
        } finally {
            e.target.value = ''; // 성공하든 실패하든 file input 초기화
        }
    };
    reader.readAsText(file);
}

/** '전체 초기화' */
function clearAll() {
    if (confirm('정말 모든 작업을 초기화하시겠습니까?')) {
        nodes = [];
        lines = [];
        legend = [...defaultLegend]; // 기본 범례로 리셋
        lastNodeId = 0;
        
        resetInteractionState();

        updateLegendDisplay();
        updateCharacterDisplay();
        draw();
        statusArea.textContent = '모든 내용이 초기화되었습니다.';
    }
}

// ===================================================================
// 유틸리티 함수
// ===================================================================

/** 캔버스 기준 좌표 반환 (마우스/터치 공용) */
function getCanvasCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

/** 특정 좌표에 있는 노드를 찾습니다 (역순 탐색, 즉 위에 그려진 노드 우선) */
function findNodeAt(x, y) {
    for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        const dx = node.x - x;
        const dy = node.y - y;
        // 피타고라스 정리 (sqrt 불필요)
        if (dx * dx + dy * dy < node.radius * node.radius) {
            return node;
        }
    }
    return null;
}

/** 모든 상호작용 관련 상태를 초기값으로 리셋 */
function resetInteractionState() {
    if(selectedLegendEl) selectedLegendEl.classList.remove('active');
    selectedLegendEl = null;
    selectedColor = '#000000';
    selectedLabel = '';
    selection = null;
    highlightedNodeId = null;
    isDragging = false;
    draggingNode = null;
}

// ===================================================================
// 스크립트 실행
// ===================================================================

initialize();
