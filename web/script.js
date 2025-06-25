const ipv4Input = document.getElementById('ipv4');
const ipv6Input = document.getElementById('ipv6');
const generateAdguardConfigButton = document.getElementById('generate-adguard-config');
const generateSniproxyConfigButton = document.getElementById('generate-sniproxy-config');
const generateSniproxyConfigAllButton = document.getElementById('generate-sniproxy-config-all');
const generateDnsmasqConfigButton = document.getElementById('generate-dnsmasq-config');
const generateSmartdnsConfigButton = document.getElementById('generate-smartdns-config');
const generateXrayConfigButton = document.getElementById('generate-xray-config');
const generateXrayAlicePublicConfigButton = document.getElementById('generate-xray-alice-public-config');
const configOutput = document.getElementById('config-output');
const copyButton = document.getElementById('copy-config');
const downloadButton = document.getElementById('download-config');
const statusMessage = document.getElementById('status-message');
const fetchCategoriesButton = document.getElementById('fetch-categories');
const categoryCheckboxesContainer = document.getElementById('category-checkboxes');
const selectAllNewButton = document.getElementById('select-all-categories-new');
const deselectAllNewButton = document.getElementById('deselect-all-categories-new');
const selectAliceWhitelistButton = document.getElementById('select-alice-whitelist');
const enableAliceSocksCheckbox = document.getElementById('enable-alice-socks');

let currentConfigType = '';
let categoryList = [];
let categoryDomainLookup = {};
let statusTimeoutId = null;

function showStatus(message, isError = false) {
    if (statusTimeoutId) {
        clearTimeout(statusTimeoutId);
    }

    statusMessage.textContent = message;
    statusMessage.className = `status ${isError ? 'error' : 'success'}`;
    statusMessage.style.display = 'block';

    statusTimeoutId = setTimeout(() => {
        statusMessage.style.display = 'none';
        statusTimeoutId = null;
    }, 5000);
}

function displayConfig(configText, type) {
    configOutput.value = configText;
    currentConfigType = type;
    const typeName = type === 'adguard' ? 'AdguardHome 自定义规则' :
        (type === 'sniproxy' ? 'SNIProxy 配置' :
            (type === 'dnsmasq' ? 'Dnsmasq 配置' :
                (type === 'smartdns' ? 'SmartDNS 配置' :
                    (type === 'xray' ? 'Xray 域名规则' :
                        (type === 'xray-alice-public' ? 'Alice 出口配置' : '配置')))));
    showStatus(`成功生成 ${typeName}`);
}

function displayError(errorMessage) {
    configOutput.value = `错误：\n${errorMessage}`;
    currentConfigType = '';
    showStatus(`操作时出错: ${errorMessage}`, true);
}

fetchCategoriesButton.addEventListener('click', async () => {
    fetchCategoriesButton.disabled = true;
    fetchCategoriesButton.textContent = '正在获取...';
    statusMessage.style.display = 'none';
    categoryCheckboxesContainer.innerHTML = '<p style="color: #6c757d;">正在加载...</p>';
    categoryList = [];
    categoryDomainLookup = {};

    try {
        const response = await fetch('/api/get_categories');
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || `HTTP 错误: ${response.status}`);
        }

        categoryList = result;

        categoryCheckboxesContainer.innerHTML = '';

        if (!categoryList || categoryList.length === 0) {
            categoryCheckboxesContainer.innerHTML = '<p style="color: #6c757d;">未找到分类</p>';
            showStatus('成功获取列表，但未找到有效分类', true);
            return;
        }

        categoryList.forEach((majorCat, majorIndex) => {
            const majorDiv = document.createElement('div');
            majorDiv.style.marginBottom = '5px';

            const majorLineDiv = document.createElement('div');
            majorLineDiv.style.display = 'flex';
            majorLineDiv.style.alignItems = 'center';
            majorLineDiv.style.marginBottom = '3px';

            const majorCheckboxId = `major-${majorIndex}`;
            const majorCheckbox = document.createElement('input');
            majorCheckbox.type = 'checkbox';
            majorCheckbox.id = majorCheckboxId;
            majorCheckbox.classList.add('major-checkbox');
            majorCheckbox.dataset.majorIndex = majorIndex;

            const majorLabel = document.createElement('label');
            majorLabel.htmlFor = majorCheckboxId;
            majorLabel.style.fontWeight = 'bold';
            majorLabel.textContent = majorCat.name;
            majorLabel.style.cursor = 'pointer';

            majorLineDiv.appendChild(majorCheckbox);
            majorLineDiv.appendChild(majorLabel);
            majorDiv.appendChild(majorLineDiv);

            const minorDiv = document.createElement('div');
            minorDiv.style.marginLeft = '25px';

            if (majorCat.minors && majorCat.minors.length > 0) {
                majorCat.minors.forEach(minorCat => {
                    const minorCheckboxId = `minor-${majorIndex}-${minorCat.name.replace(/\s+/g, '-')}`;
                    const minorCheckbox = document.createElement('input');
                    minorCheckbox.type = 'checkbox';
                    minorCheckbox.id = minorCheckboxId;
                    minorCheckbox.classList.add('minor-checkbox');
                    minorCheckbox.value = minorCat.name;
                    minorCheckbox.dataset.majorIndex = majorIndex;

                    const minorLabel = document.createElement('label');
                    minorLabel.htmlFor = minorCheckboxId;
                    minorLabel.style.marginLeft = '5px';
                    minorLabel.style.fontWeight = 'normal';
                    minorLabel.textContent = minorCat.name;
                    minorLabel.style.cursor = 'pointer';

                    const minorLineDiv = document.createElement('div');
                    minorLineDiv.style.display = 'flex';
                    minorLineDiv.style.alignItems = 'center';
                    minorLineDiv.style.marginBottom = '2px';

                    minorLineDiv.appendChild(minorCheckbox);
                    minorLineDiv.appendChild(minorLabel);
                    minorDiv.appendChild(minorLineDiv);


                    if (!categoryDomainLookup[minorCat.name]) {
                        categoryDomainLookup[minorCat.name] = [];
                    }
                    const uniqueDomains = new Set([...categoryDomainLookup[minorCat.name], ...minorCat.domains]);
                    categoryDomainLookup[minorCat.name] = Array.from(uniqueDomains);
                });
            } else {
                minorDiv.innerHTML = '<span style="color: #6c757d; font-style: italic;">无子分类</span>';
            }

            majorDiv.appendChild(minorDiv);
            categoryCheckboxesContainer.appendChild(majorDiv);
        });

        addCheckboxListeners();

        if (categoryCheckboxesContainer.childElementCount === 0) {
            categoryCheckboxesContainer.innerHTML = '<p style="color: #6c757d;">未找到包含域名的分类</p>';
            showStatus('成功获取列表，但未找到包含域名的分类', true);
        } else {
            showStatus('分类已成功加载并显示');
        }

    } catch (error) {
        displayError(`获取分类失败: ${error.message || '无法连接到服务器或发生未知错误'}`);
        categoryCheckboxesContainer.innerHTML = '<p style="color: #dc3545;">加载失败，请重试</p>';
    } finally {
        fetchCategoriesButton.disabled = false;
        fetchCategoriesButton.textContent = '获取并显示分类';
    }
});

function addCheckboxListeners() {
    categoryCheckboxesContainer.querySelectorAll('.major-checkbox').forEach(majorCheckbox => {
        majorCheckbox.addEventListener('change', (event) => {
            const majorIndex = event.target.dataset.majorIndex;
            const isChecked = event.target.checked;
            categoryCheckboxesContainer.querySelectorAll(`.minor-checkbox[data-major-index="${majorIndex}"]`).forEach(minorCheckbox => {
                minorCheckbox.checked = isChecked;
            });
        });
    });

    categoryCheckboxesContainer.querySelectorAll('.minor-checkbox').forEach(minorCheckbox => {
        minorCheckbox.addEventListener('change', (event) => {
            const majorIndex = event.target.dataset.majorIndex;
            const allMinors = categoryCheckboxesContainer.querySelectorAll(`.minor-checkbox[data-major-index="${majorIndex}"]`);
            const allChecked = Array.from(allMinors).every(cb => cb.checked);
            const someChecked = Array.from(allMinors).some(cb => cb.checked);
            const majorCheckbox = categoryCheckboxesContainer.querySelector(`.major-checkbox[data-major-index="${majorIndex}"]`);

            if (majorCheckbox) {
                if (allChecked) {
                    majorCheckbox.checked = true;
                    majorCheckbox.indeterminate = false;
                } else if (someChecked) {
                    majorCheckbox.checked = false;
                    majorCheckbox.indeterminate = true;
                } else {
                    majorCheckbox.checked = false;
                    majorCheckbox.indeterminate = false;
                }
            }
        });
    });

    let lastClickedMinorCheckboxIndex = -1;
    const allMinorCheckboxes = Array.from(categoryCheckboxesContainer.querySelectorAll('.minor-checkbox'));

    allMinorCheckboxes.forEach((minorCheckbox, index) => {
        minorCheckbox.addEventListener('click', (event) => {
            const currentCheckbox = event.target;
            const currentIndex = allMinorCheckboxes.indexOf(currentCheckbox);

            if (event.shiftKey && lastClickedMinorCheckboxIndex !== -1) {
                const start = Math.min(lastClickedMinorCheckboxIndex, currentIndex);
                const end = Math.max(lastClickedMinorCheckboxIndex, currentIndex);
                const isChecking = currentCheckbox.checked;

                for (let i = start; i <= end; i++) {
                    if (allMinorCheckboxes[i] !== currentCheckbox) {
                        if (allMinorCheckboxes[i].checked !== isChecking) {
                            allMinorCheckboxes[i].checked = isChecking;
                            allMinorCheckboxes[i].dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }
                }
            }
            lastClickedMinorCheckboxIndex = currentIndex;
        });
    });
}

generateAdguardConfigButton.addEventListener('click', async () => {
    const ipv4 = ipv4Input.value.trim();
    const ipv6 = ipv6Input.value.trim();

    if (!ipv4 && !ipv6) {
        showStatus('IPv4 或 IPv6 地址请至少输入一个', true);
        return;
    }

    const ipv4Regex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    if (ipv4 && !ipv4Regex.test(ipv4)) {
        showStatus('输入的 IPv4 地址格式无效', true);
        return;
    }
    if (ipv6 && !/^[a-fA-F0-9:]+$/.test(ipv6.replace(/\./g, ''))) {

    }

    let orderedSelectedDomains = [];
    let seenDomains = new Set();


    categoryList.forEach((majorCat, majorIndex) => {
        if (majorCat.minors && majorCat.minors.length > 0) {
            majorCat.minors.forEach(minorCat => {
                const minorCheckboxId = `minor-${majorIndex}-${minorCat.name.replace(/\s+/g, '-')}`;
                const minorCheckbox = document.getElementById(minorCheckboxId);

                if (minorCheckbox && minorCheckbox.checked) {
                    const domainsForCategory = categoryDomainLookup[minorCat.name];
                    if (domainsForCategory) {
                        domainsForCategory.forEach(domain => {
                            if (!seenDomains.has(domain)) {
                                orderedSelectedDomains.push(domain);
                                seenDomains.add(domain);

                            }
                        });
                    } else {

                    }
                }
            });
        }
    });


    const selectedDomains = orderedSelectedDomains;


    if (selectedDomains.length === 0) {
        showStatus('请至少选择一个包含有效域名的分类', true);
        return;
    }

    if (selectedDomains.length === 0) {
        showStatus('所选分类下未找到任何域名', true);
        return;
    }

    configOutput.value = '正在生成 AdguardHome 自定义规则...';
    statusMessage.style.display = 'none';

    try {
        const response = await fetch('/api/generate_adguard_config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ipv4: ipv4,
                ipv6: ipv6,
                selected_domains: selectedDomains
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || `HTTP 错误: ${response.status}`);
        }

        displayConfig(result.config, 'adguard');

    } catch (error) {
        displayError(error.message || '无法连接到服务器或发生未知错误');
    }
});

generateSniproxyConfigButton.addEventListener('click', async () => {
    let orderedSelectedDomains = [];
    let seenDomains = new Set();

    if (!categoryList || categoryList.length === 0 || Object.keys(categoryDomainLookup).length === 0) {
        showStatus('请先点击“获取并显示分类”并确保分类已加载', true);
        return;
    }

    categoryList.forEach((majorCat, majorIndex) => {
        if (majorCat.minors && majorCat.minors.length > 0) {
            majorCat.minors.forEach(minorCat => {
                const minorCheckboxId = `minor-${majorIndex}-${minorCat.name.replace(/\s+/g, '-')}`;
                const minorCheckbox = document.getElementById(minorCheckboxId);

                if (minorCheckbox && minorCheckbox.checked) {
                    const domainsForCategory = categoryDomainLookup[minorCat.name];
                    if (domainsForCategory) {
                        domainsForCategory.forEach(domain => {
                            if (!seenDomains.has(domain)) {
                                orderedSelectedDomains.push(domain);
                                seenDomains.add(domain);
                            }
                        });
                    }
                }
            });
        }
    });

    if (orderedSelectedDomains.length === 0) {
        showStatus('请至少选择一个包含有效域名的分类', true);
        return;
    }

    configOutput.value = '正在生成 SNIProxy 配置...';
    statusMessage.style.display = 'none';

    try {
        const response = await fetch('/api/generate_sniproxy_config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                selected_domains: orderedSelectedDomains,
                enable_alice_socks: enableAliceSocksCheckbox.checked
            })
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || `HTTP 错误: ${response.status}`);
        }

        displayConfig(result.config, 'sniproxy');

    } catch (error) {
        displayError(error.message || '无法连接到服务器或发生未知错误');
    }
});

generateSniproxyConfigAllButton.addEventListener('click', async () => {
    configOutput.value = '正在生成 SNIProxy 配置...';
    statusMessage.style.display = 'none';

    try {
        const response = await fetch('/api/generate_sniproxy_config_all', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                enable_alice_socks: enableAliceSocksCheckbox.checked
            })
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || `HTTP 错误: ${response.status}`);
        }

        displayConfig(result.config, 'sniproxy');

    } catch (error) {
        displayError(error.message || '无法连接到服务器或发生未知错误');
    }
});

generateDnsmasqConfigButton.addEventListener('click', async () => {
    const ipv4 = ipv4Input.value.trim();
    const ipv6 = ipv6Input.value.trim();

    if (!ipv4 && !ipv6) {
        showStatus('IPv4 或 IPv6 地址请至少输入一个', true);
        return;
    }

    const ipv4Regex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    if (ipv4 && !ipv4Regex.test(ipv4)) {
        showStatus('输入的 IPv4 地址格式无效', true);
        return;
    }
    if (ipv6 && !/^[a-fA-F0-9:]+$/.test(ipv6.replace(/\./g, ''))) {

    }

    let orderedSelectedDomains = [];
    let seenDomains = new Set();

    if (!categoryList || categoryList.length === 0 || Object.keys(categoryDomainLookup).length === 0) {
        showStatus('请先点击“获取并显示分类”并确保分类已加载', true);
        return;
    }

    categoryList.forEach((majorCat, majorIndex) => {
        if (majorCat.minors && majorCat.minors.length > 0) {
            majorCat.minors.forEach(minorCat => {
                const minorCheckboxId = `minor-${majorIndex}-${minorCat.name.replace(/\s+/g, '-')}`;
                const minorCheckbox = document.getElementById(minorCheckboxId);

                if (minorCheckbox && minorCheckbox.checked) {
                    const domainsForCategory = categoryDomainLookup[minorCat.name];
                    if (domainsForCategory) {
                        domainsForCategory.forEach(domain => {
                            if (!seenDomains.has(domain)) {
                                orderedSelectedDomains.push(domain);
                                seenDomains.add(domain);
                            }
                        });
                    }
                }
            });
        }
    });

    if (orderedSelectedDomains.length === 0) {
        showStatus('请至少选择一个包含有效域名的分类', true);
        return;
    }

    configOutput.value = '正在生成 Dnsmasq 配置...';
    statusMessage.style.display = 'none';

    try {
        const response = await fetch('/api/generate_dnsmasq_config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ipv4: ipv4,
                ipv6: ipv6,
                selected_domains: orderedSelectedDomains
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || `HTTP 错误: ${response.status}`);
        }

        displayConfig(result.config, 'dnsmasq');

    } catch (error) {
        displayError(error.message || '无法连接到服务器或发生未知错误');
    }
});

generateSmartdnsConfigButton.addEventListener('click', async () => {
    const ipv4 = ipv4Input.value.trim();
    const ipv6 = ipv6Input.value.trim();

    if (!ipv4 && !ipv6) {
        showStatus('IPv4 或 IPv6 地址请至少输入一个', true);
        return;
    }

    const ipv4Regex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    if (ipv4 && !ipv4Regex.test(ipv4)) {
        showStatus('输入的 IPv4 地址格式无效', true);
        return;
    }
    if (ipv6 && !/^[a-fA-F0-9:]+$/.test(ipv6.replace(/\./g, ''))) {

    }

    let orderedSelectedDomains = [];
    let seenDomains = new Set();

    if (!categoryList || categoryList.length === 0 || Object.keys(categoryDomainLookup).length === 0) {
        showStatus('请先点击“获取并显示分类”并确保分类已加载', true);
        return;
    }

    categoryList.forEach((majorCat, majorIndex) => {
        if (majorCat.minors && majorCat.minors.length > 0) {
            majorCat.minors.forEach(minorCat => {
                const minorCheckboxId = `minor-${majorIndex}-${minorCat.name.replace(/\s+/g, '-')}`;
                const minorCheckbox = document.getElementById(minorCheckboxId);

                if (minorCheckbox && minorCheckbox.checked) {
                    const domainsForCategory = categoryDomainLookup[minorCat.name];
                    if (domainsForCategory) {
                        domainsForCategory.forEach(domain => {
                            if (!seenDomains.has(domain)) {
                                orderedSelectedDomains.push(domain);
                                seenDomains.add(domain);
                            }
                        });
                    }
                }
            });
        }
    });

    if (orderedSelectedDomains.length === 0) {
        showStatus('请至少选择一个包含有效域名的分类', true);
        return;
    }

    configOutput.value = '正在生成 SmartDNS 配置...';
    statusMessage.style.display = 'none';

    try {
        const response = await fetch('/api/generate_smartdns_config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ipv4: ipv4,
                ipv6: ipv6,
                selected_domains: orderedSelectedDomains
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || `HTTP 错误: ${response.status}`);
        }

        displayConfig(result.config, 'smartdns');

    } catch (error) {
        displayError(error.message || '无法连接到服务器或发生未知错误');
    }
});

copyButton.addEventListener('click', () => {
    const configText = configOutput.value;
    if (!configText || configText.startsWith('错误：') || configText.startsWith('正在生成')) {
        showStatus('没有可复制的有效配置内容', true);
        return;
    }
    navigator.clipboard.writeText(configText)
        .then(() => {
            showStatus('配置已成功复制到剪贴板');
        })
        .catch(err => {
            showStatus('无法复制到剪贴板，请手动复制', true);
        });
});

downloadButton.addEventListener('click', () => {
    const configText = configOutput.value;
    if (!configText || configText.startsWith('错误：') || configText.startsWith('正在生成')) {
        showStatus('没有可下载的有效配置内容', true);
        return;
    }

    let filename = "config_output.txt";
    if (currentConfigType === 'adguard') {
        filename = "adguard_rules.txt";
    } else if (currentConfigType === 'sniproxy') {
        filename = "config.yaml";
    } else if (currentConfigType === 'dnsmasq') {
        filename = "dnsmasq.conf";
    } else if (currentConfigType === 'smartdns') {
        filename = "smartdns.conf";
    } else if (currentConfigType === 'xray') {
        filename = "xray_rules.txt";
    } else if (currentConfigType === 'xray-alice-public') {
        filename = "xray_alice_public.json";
    }

    const blob = new Blob([configText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showStatus(`配置已开始下载，文件名为 ${filename}`);
});

selectAllNewButton.addEventListener('click', () => {
    categoryCheckboxesContainer.querySelectorAll('.minor-checkbox').forEach(checkbox => {
        checkbox.checked = true;

    });
    categoryCheckboxesContainer.querySelectorAll('.major-checkbox').forEach(majorCheckbox => {
        majorCheckbox.checked = true;
        majorCheckbox.indeterminate = false;
    });
});

if (generateXrayConfigButton) {
    generateXrayConfigButton.addEventListener('click', async () => {
        let orderedSelectedDomains = [];
        let seenDomains = new Set();

        if (!categoryList || categoryList.length === 0 || Object.keys(categoryDomainLookup).length === 0) {
            showStatus('请先点击“获取并显示分类”并确保分类已加载', true);
            return;
        }

        categoryList.forEach((majorCat, majorIndex) => {
            if (majorCat.minors && majorCat.minors.length > 0) {
                majorCat.minors.forEach(minorCat => {
                    const minorCheckboxId = `minor-${majorIndex}-${minorCat.name.replace(/\s+/g, '-')}`;
                    const minorCheckbox = document.getElementById(minorCheckboxId);

                    if (minorCheckbox && minorCheckbox.checked) {
                        const domainsForCategory = categoryDomainLookup[minorCat.name];
                        if (domainsForCategory) {
                            domainsForCategory.forEach(domain => {
                                if (!seenDomains.has(domain)) {
                                    orderedSelectedDomains.push(domain);
                                    seenDomains.add(domain);
                                }
                            });
                        }
                    }
                });
            }
        });

        if (orderedSelectedDomains.length === 0) {
            showStatus('请至少选择一个包含有效域名的分类', true);
            return;
        }

        configOutput.value = '正在生成 Xray 规则...';
        statusMessage.style.display = 'none';

        try {
            const response = await fetch('/api/generate_xray_config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    selected_domains: orderedSelectedDomains
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `HTTP 错误: ${response.status}`);
            }

            displayConfig(result.config, 'xray');

        } catch (error) {
            displayError(error.message || '无法连接到服务器或发生未知错误');
        }
    });
}

deselectAllNewButton.addEventListener('click', () => {
    categoryCheckboxesContainer.querySelectorAll('.minor-checkbox, .major-checkbox').forEach(checkbox => {
        checkbox.checked = false;
        checkbox.indeterminate = false;
    });
});

if (selectAliceWhitelistButton) {
    selectAliceWhitelistButton.addEventListener('click', () => {
        if (!categoryList || categoryList.length === 0) {
            showStatus('请先点击“获取并显示分类”并确保分类已加载', true);
            return;
        }

        const targetMajorCategories = [
            "Taiwan Media",
            "Japan Media",
            "Hong Kong Media",
            "AI Platform"
        ];

        const globalPlatformSpecificMinors = [
            "DAZN",
            "Hotstar",
            "Disney+",
            "Netflix",
            "Amazon Prime Video:",
            "TVBAnywhere+",
            "Viu.com",
            "Tiktok"
        ];

        categoryList.forEach((majorCat, majorIndex) => {
            const majorCheckbox = document.getElementById(`major-${majorIndex}`);

            if (targetMajorCategories.includes(majorCat.name)) {
                if (majorCat.minors && majorCat.minors.length > 0) {
                    majorCat.minors.forEach(minorCat => {
                        const minorCheckboxId = `minor-${majorIndex}-${minorCat.name.replace(/\s+/g, '-')}`;
                        const minorCheckbox = document.getElementById(minorCheckboxId);
                        if (minorCheckbox && !minorCheckbox.checked) {
                            minorCheckbox.checked = true;
                            minorCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    });
                }
            } else if (majorCat.name === "Global Platform") {
                if (majorCat.minors && majorCat.minors.length > 0) {
                    majorCat.minors.forEach(minorCat => {
                        const isIncluded = globalPlatformSpecificMinors.includes(minorCat.name);
                        if (isIncluded) {
                            const minorCheckboxId = `minor-${majorIndex}-${minorCat.name.replace(/\s+/g, '-')}`;
                            const minorCheckbox = document.getElementById(minorCheckboxId);
                            if (minorCheckbox && !minorCheckbox.checked) {
                                minorCheckbox.checked = true;
                                minorCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
                            } else if (minorCheckbox && minorCheckbox.checked) {
                            } else if (!minorCheckbox) {
                            }
                        }
                    });
                }
            }
        });
        showStatus('Alice白名单规则已勾选');
    });
}

if (generateXrayAlicePublicConfigButton) {
    generateXrayAlicePublicConfigButton.addEventListener('click', () => {
        const alicePublicConfig = {
            "tag": "alice-public-socks",
            "protocol": "socks",
            "settings": {
                "servers": [
                    {
                        "address": "[2a14:67c0:118::1]",
                        "port": 35000,
                        "users": [
                            {
                                "user": "alice",
                                "pass": "alice..MVM"
                            }
                        ]
                    }
                ]
            }
        };
        displayConfig(JSON.stringify(alicePublicConfig, null, 2), 'xray-alice-public');
    });
}
