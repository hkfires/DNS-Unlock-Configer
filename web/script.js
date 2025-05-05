const ipv4Input = document.getElementById('ipv4');
        const ipv6Input = document.getElementById('ipv6');
        const generateStreamListButton = document.getElementById('generate-stream-list');
        const generateConfigYamlButton = document.getElementById('generate-config-yaml');
        const configOutput = document.getElementById('config-output');
        const copyButton = document.getElementById('copy-config');
        const downloadButton = document.getElementById('download-config');
        const statusMessage = document.getElementById('status-message');
        const fetchCategoriesButton = document.getElementById('fetch-categories');
        const categoryCheckboxesContainer = document.getElementById('category-checkboxes');
        const selectAllNewButton = document.getElementById('select-all-categories-new');
        const deselectAllNewButton = document.getElementById('deselect-all-categories-new');


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
            const typeName = type === 'stream' ? 'AdguardHome 自定义规则' : (type === 'yaml' ? 'SNIProxy 配置' : '配置');
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


        generateStreamListButton.addEventListener('click', async () => {
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
                const response = await fetch('/api/generate_stream_list', {
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

                displayConfig(result.config, 'stream');

            } catch (error) {
                displayError(error.message || '无法连接到服务器或发生未知错误');
            }
        });

        generateConfigYamlButton.addEventListener('click', async () => {
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
                const response = await fetch('/api/generate_config_yaml', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ selected_domains: orderedSelectedDomains })
                });
                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || `HTTP 错误: ${response.status}`);
                }

                displayConfig(result.config, 'yaml');

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
            if (currentConfigType === 'stream') {
                filename = "adguard_rules.txt";
            } else if (currentConfigType === 'yaml') {
                filename = "config.yaml";
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

         deselectAllNewButton.addEventListener('click', () => {
             categoryCheckboxesContainer.querySelectorAll('.minor-checkbox, .major-checkbox').forEach(checkbox => {
                 checkbox.checked = false;
                 checkbox.indeterminate = false;
             });
         });
