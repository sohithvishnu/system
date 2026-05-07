//
//  SettingsView.swift
//  System-app
//
//  Created by Advanced Intelligence Research on 06.05.2026.
//

import SwiftUI

struct ModelsResponse: Codable {
    let success: Bool
    let models: [String]?
    let error: String?
}



struct SettingsView: View {
    @EnvironmentObject var authManager: AuthManager
    
    // @AppStorage replaces React Native's AsyncStorage!
    // It automatically saves to UserDefaults and updates the UI when changed.
    @AppStorage("system_active_model") private var activeModel: String = ""
    @AppStorage("system_custom_directive") private var customDirective: String = ""
    
    // State variables
    @State private var models: [String] = []
    @State private var isLoadingModels = true
    @State private var errorMessage: String? = nil
    
    var body: some View {
        AppShellView {
            ScrollView {
                VStack(alignment: .leading, spacing: 40) {
                    
                    // --- HEADER ---
                    VStack(alignment: .leading, spacing: 5) {
                        Text("settings")
                            .font(AppTheme.font(size: 24, weight: .bold))
                            .foregroundColor(.white)
                        Text("~/config")
                            .font(AppTheme.font(size: 14))
                            .foregroundColor(AppTheme.textSecondary)
                    }
                    
                    // --- CONNECTION SECTION ---
                    SettingsSection(label: "connection") {
                        SettingsCard {
                            Text(APIConfig.baseURL)
                                .font(AppTheme.font(size: 14))
                                .foregroundColor(AppTheme.textSecondary)
                        }
                        
                        GhostButton(label: "test connection") {
                            print("Connection Test: \(APIConfig.baseURL)")
                        }
                        
                        HStack(spacing: 8) {
                            Circle()
                                .fill(AppTheme.neonGreen)
                                .frame(width: 6, height: 6)
                            Text("connected")
                                .font(AppTheme.font(size: 12))
                                .foregroundColor(AppTheme.textSecondary)
                        }
                        .padding(.top, 5)
                    }
                    
                    // --- MODEL SECTION ---
                    SettingsSection(label: "model") {
                        if !activeModel.isEmpty {
                            SettingsCard {
                                HStack(spacing: 8) {
                                    Circle().fill(AppTheme.neonGreen).frame(width: 6, height: 6)
                                    Text(activeModel)
                                        .font(AppTheme.font(size: 14))
                                        .foregroundColor(.white)
                                }
                            }
                        }
                        
                        if isLoadingModels {
                            HStack(spacing: 10) {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.neonGreen))
                                Text("fetching models...")
                                    .font(AppTheme.font(size: 12))
                                    .foregroundColor(AppTheme.textSecondary)
                            }
                            .padding(.vertical)
                        } else if let error = errorMessage {
                            VStack(alignment: .leading, spacing: 5) {
                                Text("connection failed")
                                    .font(AppTheme.font(size: 14, weight: .bold))
                                    .foregroundColor(.red)
                                Text(error)
                                    .font(AppTheme.font(size: 12))
                                    .foregroundColor(AppTheme.textSecondary)
                            }
                            .padding()
                            .background(Color.red.opacity(0.1))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.red.opacity(0.3), lineWidth: 1))
                            
                        } else if models.isEmpty {
                            Text("no models available")
                                .font(AppTheme.font(size: 12))
                                .foregroundColor(AppTheme.textSecondary)
                                .padding(.vertical)
                        } else {
                            VStack(spacing: 10) {
                                ForEach(models, id: \.self) { model in
                                    SettingsCard(isActive: activeModel == model) {
                                        HStack {
                                            Text(model)
                                                .font(AppTheme.font(size: 14, weight: activeModel == model ? .bold : .regular))
                                                .foregroundColor(activeModel == model ? AppTheme.neonGreen : .white)
                                            Spacer()
                                            if activeModel == model {
                                                Image(systemName: "checkmark")
                                                    .foregroundColor(AppTheme.neonGreen)
                                            }
                                        }
                                    }
                                    .onTapGesture {
                                        // Automatically saves to @AppStorage!
                                        activeModel = model
                                    }
                                }
                            }
                        }
                    }
                    
                    // --- APPEARANCE SECTION ---
                    SettingsSection(label: "appearance") {
                        SettingsCard {
                            ZStack(alignment: .topLeading) {
                                if customDirective.isEmpty {
                                    Text("custom ai directives (monospace, optional)")
                                        .font(AppTheme.font(size: 14))
                                        .foregroundColor(AppTheme.textSecondary)
                                        .padding(.top, 8)
                                        .padding(.leading, 4)
                                }
                                
                                TextEditor(text: $customDirective)
                                    .font(AppTheme.font(size: 14))
                                    .foregroundColor(.white)
                                    .frame(minHeight: 100)
                                    .scrollContentBackground(.hidden) // Removes default white background
                                    .background(Color.clear)
                            }
                        }
                    }
                    
                    // --- DATA SECTION ---
                    SettingsSection(label: "data") {
                        GhostButton(label: "clear cache") {
                            print("Cache cleared")
                        }
                        
                        GhostButton(label: "clear history", isDanger: true) {
                            print("History cleared")
                        }
                    }
                    
                    Spacer(minLength: 50)
                }
                .frame(maxWidth: 600, alignment: .leading) // Prevents ultra-wide stretching on Mac
                .padding(.vertical)
            }
        }
        .task {
            await fetchModels()
        }
    }
    
    // --- NETWORKING LOGIC ---
    private func fetchModels() async {
        isLoadingModels = true
        errorMessage = nil
        
        guard let url = URL(string: "\(APIConfig.baseURL)/api/ai/models") else {
            errorMessage = "Invalid URL"
            isLoadingModels = false
            return
        }
        
        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            
            guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
                errorMessage = "SYSTEM_ERR: Backend connection severed."
                isLoadingModels = false
                return
            }
            
            let decodedResponse = try JSONDecoder().decode(ModelsResponse.self, from: data)
            
            if decodedResponse.success {
                self.models = decodedResponse.models ?? []
                
                // If no active model is selected, default to the first one
                if activeModel.isEmpty && !self.models.isEmpty {
                    activeModel = self.models[0]
                }
            } else {
                self.errorMessage = decodedResponse.error ?? "Failed to fetch models"
            }
            
        } catch {
            self.errorMessage = "SYSTEM_ERR: Could not connect to backend."
            print("Fetch models error: \(error)")
        }
        
        isLoadingModels = false
    }
}

// MARK: - Helper Components

struct SettingsSection<Content: View>: View {
    let label: String
    let content: Content
    
    init(label: String, @ViewBuilder content: () -> Content) {
        self.label = label
        self.content = content()
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 15) {
            Text(label.uppercased())
                .font(AppTheme.font(size: 12, weight: .bold))
                .foregroundColor(AppTheme.neonGreen)
                .tracking(1.5)
            
            content
        }
    }
}

struct SettingsCard<Content: View>: View {
    var isActive: Bool = false
    let content: Content
    
    init(isActive: Bool = false, @ViewBuilder content: () -> Content) {
        self.isActive = isActive
        self.content = content()
    }
    
    var body: some View {
        content
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(isActive ? AppTheme.neonGreen.opacity(0.1) : Color.white.opacity(0.05))
                    .background(.ultraThinMaterial)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isActive ? AppTheme.neonGreen.opacity(0.5) : Color.white.opacity(0.1), lineWidth: 1)
            )
    }
}

struct GhostButton: View {
    let label: String
    var isDanger: Bool = false
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(label)
                .font(AppTheme.font(size: 14, weight: .bold))
                .foregroundColor(isDanger ? .red : AppTheme.neonGreen)
                .padding(.vertical, 12)
                .padding(.horizontal, 20)
                .background(Color.clear)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(isDanger ? Color.red.opacity(0.5) : AppTheme.neonGreen.opacity(0.5), lineWidth: 1)
                )
        }
        .buttonStyle(PlainButtonStyle())
    }
}
